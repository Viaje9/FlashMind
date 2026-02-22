import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpeakingService as SpeakingApiService } from '@flashmind/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingAudioPlayerService } from './speaking-audio-player.service';
import { SPEAKING_DEFAULT_SETTINGS } from './speaking.domain';
import { SpeakingRepository } from './speaking.repository';
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
          provide: SpeakingAudioPlayerService,
          useValue: {
            error: signal<string | null>(null),
            playingKey: signal<string | null>(null),
            stop: vi.fn(),
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
