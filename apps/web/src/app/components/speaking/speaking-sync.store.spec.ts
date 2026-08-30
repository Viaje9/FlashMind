import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Configuration, SpeakingHistoryService } from '@flashmind/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingRepository } from './speaking.repository';
import { SpeakingLocalRepository } from './speaking-local.repository';
import { AuthService } from '../../services/auth.service';
import type { SpeakingConversation, SpeakingMessage } from './speaking.domain';

describe('Speaking 文字同步與帳號隔離', () => {
  const user = signal({ id: 'u1', email: 'u1@example.test' });
  let records: Map<string, SpeakingConversation>,
    messages: SpeakingMessage[],
    api: Record<string, ReturnType<typeof vi.fn>>,
    repository: SpeakingRepository;
  beforeEach(() => {
    user.set({ id: 'u1', email: 'u1@example.test' });
    records = new Map();
    messages = [];
    api = {
      createSpeakingSession: vi.fn().mockReturnValue(of({ data: { id: 'remote-1', revision: 0 } })),
      appendSpeakingMessages: vi.fn().mockReturnValue(of({ data: { revision: 1 } })),
    };
    TestBed.configureTestingModule({
      providers: [
        SpeakingRepository,
        { provide: AuthService, useValue: { user } },
        { provide: Configuration, useValue: { basePath: 'https://flashmind.example/api' } },
        { provide: SpeakingHistoryService, useValue: api },
        {
          provide: SpeakingLocalRepository,
          useValue: {
            getConversation: vi.fn(async (id: string) =>
              records.has(id)
                ? {
                    conversation: structuredClone(records.get(id)!),
                    messages: structuredClone(messages),
                  }
                : null,
            ),
            saveConversation: vi.fn(async (value: SpeakingConversation) => {
              records.set(value.id, structuredClone(value));
            }),
            saveMessage: vi.fn(async (value: SpeakingMessage) => {
              messages = [...messages.filter((m) => m.id !== value.id), value];
            }),
            listConversations: vi.fn(async () => [...records.values()]),
            listMessages: vi.fn(async () => messages),
            loadSettings: vi.fn(() => ({})),
          },
        },
      ],
    });
    repository = TestBed.inject(SpeakingRepository);
  });
  it('等待最終逐字稿才送出，送出的資料沒有音訊', async () => {
    await repository.beginConversation('c1');
    await repository.saveMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      text: '',
      audioBlobKey: 'audio1',
      createdAt: new Date().toISOString(),
    });
    expect(await repository.syncConversation('c1')).toBe(true);
    expect(api['createSpeakingSession']).not.toHaveBeenCalled();
    await repository.saveMessage({ ...messages[0], text: 'I walk every day.' });
    expect(await repository.syncConversation('c1')).toBe(true);
    expect(api['appendSpeakingMessages'].mock.calls[0][1].messages[0]).toMatchObject({
      id: 'm1',
      text: 'I walk every day.',
    });
    expect(JSON.stringify(api['appendSpeakingMessages'].mock.calls)).not.toContain('audioBlobKey');
  });
  it('斷線保留同一 creation payload 與訊息，重試成功清除待同步', async () => {
    await repository.beginConversation('c1');
    await repository.saveMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      text: 'Hello.',
      createdAt: new Date().toISOString(),
    });
    api['createSpeakingSession'].mockReturnValueOnce(throwError(() => new Error('offline')));
    expect(await repository.syncConversation('c1')).toBe(false);
    expect(records.get('c1')?.syncPending).toBe(true);
    expect(await repository.syncConversation('c1')).toBe(true);
    expect(records.get('c1')?.syncPending).toBe(false);
    expect(api['createSpeakingSession'].mock.calls[0][0]).toEqual(
      api['createSpeakingSession'].mock.calls[1][0],
    );
    expect(messages).toHaveLength(1);
  });
  it('切換帳號後不得提交前帳號的待同步資料', async () => {
    await repository.beginConversation('c1');
    await repository.saveMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      text: 'Hello.',
      createdAt: new Date().toISOString(),
    });
    user.set({ id: 'u2', email: 'u2@example.test' });
    expect(await repository.syncConversation('c1')).toBe(false);
    expect(api['createSpeakingSession']).not.toHaveBeenCalled();
    expect(await repository.getConversation('c1')).toBeNull();
  });
  it('未歸屬的舊資料不得由一般同步自動認領', async () => {
    records.set('legacy', {
      id: 'legacy',
      title: '舊',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    });
    expect(await repository.syncConversation('legacy')).toBe(false);
    expect(api['createSpeakingSession']).not.toHaveBeenCalled();
  });
});
