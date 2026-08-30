import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpeakingHistoryService } from '@flashmind/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { SpeakingLocalRepository } from './speaking-local.repository';
import { SpeakingMigrationStore } from './speaking-migration.store';

describe('Speaking 舊資料搬移', () => {
  const user = signal({ id: 'u1', email: 'u1@example.test' });
  const conversation = {
    id: 'old-1',
    title: '散步',
    summary: 'I walk every day.',
    messageCount: 1,
    createdAt: '2026-08-30T01:00:00Z',
    updatedAt: '2026-08-30T01:01:00Z',
  };
  let local: Record<string, ReturnType<typeof vi.fn>>,
    api: Record<string, ReturnType<typeof vi.fn>>,
    store: SpeakingMigrationStore;
  beforeEach(() => {
    user.set({ id: 'u1', email: 'u1@example.test' });
    local = {
      listConversations: vi.fn(async () => [conversation]),
      getConversation: vi.fn(async () => ({ conversation, messages: [] })),
      saveConversation: vi.fn(async () => undefined),
      loadSettings: vi.fn(() => ({
        lastPractice: { title: '散步', summary: 'I walk every day.' },
        nextPractice: {
          topic: 'Walks',
          speakingGoal: 'Describe walks.',
          guidingQuestions: [],
          recallTargets: [],
        },
      })),
    };
    api = {
      migrateSpeakingHistory: vi.fn().mockReturnValue(
        of({
          data: [{ clientSessionId: 'old-1', sessionId: 's1', status: 'imported', message: null }],
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        SpeakingMigrationStore,
        { provide: AuthService, useValue: { user } },
        { provide: SpeakingLocalRepository, useValue: local },
        { provide: SpeakingHistoryService, useValue: api },
      ],
    });
    store = TestBed.inject(SpeakingMigrationStore);
  });
  it('偵測與選取不會自動搬移，必須確認帳號', async () => {
    await store.scan();
    store.toggle('old-1');
    await store.migrate();
    expect(api['migrateSpeakingHistory']).not.toHaveBeenCalled();
    store.confirmOwner(true);
    await store.migrate();
    expect(api['migrateSpeakingHistory']).toHaveBeenCalledTimes(1);
    expect(local['saveConversation']).toHaveBeenLastCalledWith(
      expect.objectContaining({ migratedTo: { u1: 's1' } }),
    );
    expect(
      api['migrateSpeakingHistory'].mock.calls[0][0].sessions[0].legacyPracticeContext.summaryId,
    ).toBe('legacy-summary:old-1');
  });
  it('中斷後保留原資料和草稿，重新整理可重試', async () => {
    api['migrateSpeakingHistory'].mockReturnValueOnce(throwError(() => new Error('offline')));
    await store.scan();
    store.toggle('old-1');
    store.confirmOwner(true);
    await store.migrate();
    expect(store.results()[0].status).toBe('failed');
    expect(local['saveConversation']).toHaveBeenCalledWith(
      expect.objectContaining({ migrationDrafts: expect.any(Object) }),
    );
    await store.migrate();
    expect(store.results()[0].status).toBe('imported');
    expect(api['migrateSpeakingHistory'].mock.calls[0][0]).toEqual(
      api['migrateSpeakingHistory'].mock.calls[1][0],
    );
  });
  it('確認之後切換帳號，原確認失效', async () => {
    await store.scan();
    store.toggle('old-1');
    store.confirmOwner(true);
    user.set({ id: 'u2', email: 'u2@example.test' });
    await store.migrate();
    expect(api['migrateSpeakingHistory']).not.toHaveBeenCalled();
  });
});
