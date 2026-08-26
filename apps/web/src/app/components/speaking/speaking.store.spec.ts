import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpeakingService as SpeakingApiService } from '@flashmind/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingAudioPlayerService } from './speaking-audio-player.service';
import { SPEAKING_DEFAULT_SETTINGS } from './speaking.domain';
import { SpeakingRepository } from './speaking.repository';
import { SpeakingRealtimeService } from './speaking-realtime.service';
import { SpeakingStore } from './speaking.store';

describe('speaking.store selection translate', () => {
  let store: SpeakingStore;
  let speakingApiMock: {
    translateSpeakingText: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    speakingApiMock = {
      translateSpeakingText: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SpeakingStore,
        {
          provide: SpeakingApiService,
          useValue: speakingApiMock,
        },
        {
          provide: SpeakingRepository,
          useValue: {
            loadSettings: vi.fn(() => SPEAKING_DEFAULT_SETTINGS),
          },
        },
        {
          provide: SpeakingRealtimeService,
          useValue: {
            connect: vi.fn(async () => undefined),
            sendTurn: vi.fn(),
            disconnect: vi.fn(),
          },
        },
        {
          provide: SpeakingAudioPlayerService,
          useValue: {
            error: signal<string | null>(null),
            playingKey: signal<string | null>(null),
            pausedKey: signal<string | null>(null),
            stop: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(async () => undefined),
            play: vi.fn().mockResolvedValue(undefined),
            clearError: vi.fn(),
          },
        },
      ],
    });

    store = TestBed.inject(SpeakingStore);
  });

  it('應快取同一訊息片段翻譯，避免重複呼叫 API', async () => {
    speakingApiMock.translateSpeakingText.mockReturnValue(
      of({
        data: {
          translatedText: '你好，世界',
        },
      }),
    );

    const first = await store.translateSelectedText({
      messageId: 'assistant-1',
      selectedText: ' Hello world ',
      requestToken: 1,
    });

    const second = await store.translateSelectedText({
      messageId: 'assistant-1',
      selectedText: 'Hello world',
      requestToken: 2,
    });

    expect(first).toEqual({
      status: 'success',
      requestToken: 1,
      translatedText: '你好，世界',
      cached: false,
    });
    expect(second).toEqual({
      status: 'success',
      requestToken: 2,
      translatedText: '你好，世界',
      cached: true,
    });
    expect(speakingApiMock.translateSpeakingText).toHaveBeenCalledTimes(1);
  });

  it('翻譯 API 失敗時應回傳可顯示錯誤訊息與 request token', async () => {
    speakingApiMock.translateSpeakingText.mockReturnValue(
      throwError(() => new Error('translate failed')),
    );

    const result = await store.translateSelectedText({
      messageId: 'assistant-2',
      selectedText: 'How are you?',
      requestToken: 7,
    });

    expect(result).toEqual({
      status: 'error',
      requestToken: 7,
      errorMessage: '翻譯失敗，請稍後再試',
    });
  });

  it('選取文字超過 API 限制時應直接拒絕，避免送出請求', async () => {
    const result = await store.translateSelectedText({
      messageId: 'assistant-3',
      selectedText: 'a'.repeat(4001),
      requestToken: 9,
    });

    expect(result).toEqual({
      status: 'error',
      requestToken: 9,
      errorMessage: '選取文字過長，請縮短範圍後再試',
    });
    expect(speakingApiMock.translateSpeakingText).not.toHaveBeenCalled();
  });
});

describe('speaking.store review flow', () => {
  it('產生 Summary 後應顯示 Review 並保存下一次練習內容', async () => {
    const nextPractice = {
      topic: 'How I work with an AI agent',
      speakingGoal: 'Explain one collaboration workflow.',
      guidingQuestions: ['What do you ask the AI to do first?'],
      recallTargets: ['cooperation'],
    };
    const speakingApiMock = {
      summarizeSpeakingConversation: vi.fn(() =>
        of({
          data: {
            title: '與 AI 協作流程',
            summary: 'I explained how I work with an AI agent.',
            review: '你有清楚說明先產生初稿，再檢查調整的流程。',
            actualUses: [
              {
                term: 'function',
                zhMeaning: '功能',
                expressionContext: '描述 node tree 的需求。',
                naturalSentence: 'It depends on what kind of function the node tree needs.',
              },
            ],
            recommendations: [
              {
                term: 'cooperation',
                zhMeaning: '合作；協作',
                expressionContext: '描述和 AI 一起工作。',
                naturalSentence: 'This is cooperation between me and the AI agent.',
                recommendationReason: '符合本次對話。',
              },
            ],
            nextPractice,
            usage: {
              promptTokens: 10,
              completionTokens: 5,
              totalTokens: 15,
              promptTextTokens: 10,
              promptAudioTokens: 0,
              completionTextTokens: 5,
              completionAudioTokens: 0,
            },
          },
        }),
      ),
    };
    const conversation = {
      id: 'conversation-1',
      title: '原始標題',
      messageCount: 1,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
    };
    const messages = [
      {
        id: 'message-1',
        conversationId: 'conversation-1',
        role: 'user' as const,
        text: 'It depends on the function.',
        createdAt: '2026-08-26T00:00:00.000Z',
      },
    ];
    const repositoryMock = {
      loadSettings: vi.fn(() => SPEAKING_DEFAULT_SETTINGS),
      getConversation: vi.fn(async () => ({ conversation, messages })),
      getAudioBase64: vi.fn(async () => null),
      saveMessage: vi.fn(async () => undefined),
      saveConversation: vi.fn(async () => undefined),
      saveSettings: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SpeakingStore,
        { provide: SpeakingApiService, useValue: speakingApiMock },
        { provide: SpeakingRepository, useValue: repositoryMock },
        {
          provide: SpeakingRealtimeService,
          useValue: { connect: vi.fn(), sendTurn: vi.fn(), disconnect: vi.fn() },
        },
        {
          provide: SpeakingAudioPlayerService,
          useValue: {
            error: signal<string | null>(null),
            playingKey: signal<string | null>(null),
            pausedKey: signal<string | null>(null),
            stop: vi.fn(),
            clearError: vi.fn(),
          },
        },
      ],
    });

    const store = TestBed.inject(SpeakingStore);
    await store.loadConversation('conversation-1');
    await store.summarizeCurrentConversation();

    expect(store.messages().at(-1)?.text).toContain('練習回顧');
    expect(store.messages().at(-1)?.text).toContain('cooperation（合作；協作）');
    expect(repositoryMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ nextPractice }),
    );
    expect(repositoryMock.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '與 AI 協作流程',
        summary: 'I explained how I work with an AI agent.',
      }),
    );
  });
});
