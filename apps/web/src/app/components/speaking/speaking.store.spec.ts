import '@angular/compiler';
import {
  createEnvironmentInjector,
  runInInjectionContext,
  type EnvironmentInjector,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingService as SpeakingApiService, SpeakingVoice } from '@flashmind/api-client';
import { SpeakingAudioPlayerService } from './speaking-audio-player.service';
import { SPEAKING_DEFAULT_SETTINGS } from './speaking.domain';
import { SpeakingRepository } from './speaking.repository';
import { SpeakingStore } from './speaking.store';

describe('speaking.store', () => {
  let injector: EnvironmentInjector;
  let store: SpeakingStore;

  const apiMock = {
    createSpeakingAudioReply: vi.fn(),
    summarizeSpeakingConversation: vi.fn(),
    translateSpeakingText: vi.fn(),
    chatSpeakingAssistant: vi.fn(),
  };

  const repositoryMock = {
    loadSettings: vi.fn(() => ({
      ...SPEAKING_DEFAULT_SETTINGS,
      voice: SpeakingVoice.Nova,
    })),
    saveAudioBlob: vi.fn(async (input: { audioKey?: string; messageId: string }) => {
      return input.audioKey ?? `${input.messageId}:audio`;
    }),
    saveMessage: vi.fn(async () => undefined),
    saveMessages: vi.fn(async () => undefined),
    saveConversation: vi.fn(async () => undefined),
    getConversation: vi.fn(async () => null),
    enforceConversationStorageLimit: vi.fn(async () => undefined),
    saveSettings: vi.fn(() => undefined),
    getAudioBase64: vi.fn(async () => null),
    getAudioBlob: vi.fn(async () => null),
  };

  const audioPlayerMock = {
    play: vi.fn(async () => undefined),
    stop: vi.fn(() => undefined),
    error: vi.fn(() => null),
    playingKey: vi.fn(() => null),
    clearError: vi.fn(() => undefined),
  };

  const successResponse = (conversationId: string) => ({
    data: {
      conversationId,
      transcript: 'Hello there',
      audioBase64: 'UklGRg==',
      model: 'gpt-4o-mini-audio-preview',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        promptTextTokens: 0,
        promptAudioTokens: 1,
        completionTextTokens: 1,
        completionAudioTokens: 0,
      },
      memoryUpdate: null,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();

    injector = createEnvironmentInjector(
      [
        { provide: SpeakingApiService, useValue: apiMock },
        { provide: SpeakingRepository, useValue: repositoryMock },
        { provide: SpeakingAudioPlayerService, useValue: audioPlayerMock },
      ],
      null as unknown as EnvironmentInjector,
    );

    store = runInInjectionContext(injector, () => new SpeakingStore());
  });

  afterEach(() => {
    injector.destroy();
  });

  it('應保存後端回傳 conversationId 並於後續回合沿用', async () => {
    apiMock.createSpeakingAudioReply
      .mockReturnValueOnce(of(successResponse('conv-1')))
      .mockReturnValueOnce(of(successResponse('conv-1')));

    const blob = new Blob(['audio-1'], { type: 'audio/wav' });

    await store.sendAudioMessage(blob);
    expect(store.conversationId()).toBe('conv-1');

    await store.sendAudioMessage(blob);

    const firstCall = apiMock.createSpeakingAudioReply.mock.calls[0];
    const secondCall = apiMock.createSpeakingAudioReply.mock.calls[1];

    expect(firstCall[1]).toBeUndefined();
    expect(secondCall[1]).toBe('conv-1');
    expect(store.retryAvailable()).toBe(false);
  });

  it('會話過期時應切換新會話並保留可重試流程', async () => {
    apiMock.createSpeakingAudioReply
      .mockReturnValueOnce(of(successResponse('conv-old')))
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                error: {
                  code: 'SPEAKING_SESSION_EXPIRED',
                },
              },
            }),
        ),
      )
      .mockReturnValueOnce(of(successResponse('conv-new')));

    const blob = new Blob(['audio-2'], { type: 'audio/wav' });

    await store.sendAudioMessage(blob);
    expect(store.conversationId()).toBe('conv-old');

    await store.sendAudioMessage(blob);

    const expiredCall = apiMock.createSpeakingAudioReply.mock.calls[1];
    expect(expiredCall[1]).toBe('conv-old');
    expect(store.retryAvailable()).toBe(true);
    expect(store.error()).toContain('已切換新會話');
    expect(store.conversationId()).not.toBe('conv-old');

    await store.retryLastAudio();

    const retryCall = apiMock.createSpeakingAudioReply.mock.calls[2];
    expect(retryCall[1]).toBeUndefined();
    expect(store.conversationId()).toBe('conv-new');
    expect(store.retryAvailable()).toBe(false);
  });
});
