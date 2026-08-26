import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TargetVocabularyService } from '@flashmind/api-client';
import { DialogService } from '@flashmind/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtsStore } from '../../components/tts/tts.store';
import { TargetVocabularyComponent } from './target-vocabulary.component';

describe('TargetVocabularyComponent audio', () => {
  let component: TargetVocabularyComponent;
  const ttsStoreMock = {
    playingText: signal<string | null>(null),
    loadingText: signal<string | null>(null),
    error: signal<string | null>(null),
    playWord: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    isPlaying: vi.fn().mockReturnValue(false),
    isLoading: vi.fn().mockReturnValue(false),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TargetVocabularyService,
          useValue: { listTargetVocabulary: vi.fn() },
        },
        {
          provide: DialogService,
          useValue: { open: vi.fn() },
        },
        {
          provide: TtsStore,
          useValue: ttsStoreMock,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new TargetVocabularyComponent());
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('單字應使用 Google 單字 TTS', () => {
    component.onPlayWordAudio('cooperation');

    expect(ttsStoreMock.playWord).toHaveBeenCalledWith('cooperation');
    expect(ttsStoreMock.play).not.toHaveBeenCalled();
  });

  it('自然句子應使用 Microsoft Azure 句子 TTS', () => {
    component.onPlaySentenceAudio('This is cooperation between us.');

    expect(ttsStoreMock.play).toHaveBeenCalledWith('This is cooperation between us.');
    expect(ttsStoreMock.playWord).not.toHaveBeenCalled();
  });

  it('空白內容不應呼叫 TTS', () => {
    component.onPlayWordAudio('  ');
    component.onPlaySentenceAudio('');

    expect(ttsStoreMock.playWord).not.toHaveBeenCalled();
    expect(ttsStoreMock.play).not.toHaveBeenCalled();
  });

  it('應記住上次選擇的狀態分頁', () => {
    component.setFilter('USED');

    expect(localStorage.getItem('flashmind.target-vocabulary.filter')).toBe('USED');

    const restored = TestBed.runInInjectionContext(() => new TargetVocabularyComponent());
    expect(restored.activeFilter()).toBe('USED');
  });
});
