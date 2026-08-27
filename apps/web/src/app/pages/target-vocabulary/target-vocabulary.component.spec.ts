import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TargetVocabularyItem, TargetVocabularyService } from '@flashmind/api-client';
import { DialogService } from '@flashmind/ui';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtsStore } from '../../components/tts/tts.store';
import { TargetVocabularyComponent } from './target-vocabulary.component';

describe('TargetVocabularyComponent audio', () => {
  let component: TargetVocabularyComponent;
  const targetVocabularyApiMock = {
    listTargetVocabulary: vi.fn(),
    rejectTargetVocabularyUse: vi.fn(),
  };
  const dialogServiceMock = {
    open: vi.fn(),
  };
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
          useValue: targetVocabularyApiMock,
        },
        {
          provide: DialogService,
          useValue: dialogServiceMock,
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

  it('撤銷多次使用時應先確認，成功後更新清單與提示', () => {
    const usedItem = {
      id: 'target-1',
      term: 'site',
      status: 'USED',
      useCount: 2,
      recommendationCount: 1,
    } as TargetVocabularyItem;
    const updatedItem = {
      ...usedItem,
      status: 'PRACTICING',
      useCount: 0,
      expressionContext: null,
      naturalSentence: null,
    } as TargetVocabularyItem;
    dialogServiceMock.open.mockReturnValue({ afterClosed: () => of(true) });
    targetVocabularyApiMock.rejectTargetVocabularyUse.mockReturnValue(of({ data: updatedItem }));
    component.items.set([usedItem]);

    component.rejectActualUse(usedItem);

    expect(dialogServiceMock.open).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        data: expect.objectContaining({ message: expect.stringContaining('2 次') }),
      }),
    );
    expect(targetVocabularyApiMock.rejectTargetVocabularyUse).toHaveBeenCalledWith('target-1');
    expect(component.items()).toEqual([updatedItem]);
    expect(component.notice()).toBe('site 已移回待練習');
  });

  it('撤銷單次使用也應先確認，取消時不應呼叫 API', () => {
    const usedItem = {
      id: 'target-2',
      term: 'um',
      status: 'USED',
      useCount: 1,
      recommendationCount: 0,
    } as TargetVocabularyItem;
    dialogServiceMock.open.mockReturnValue({ afterClosed: () => of(false) });

    component.rejectActualUse(usedItem);

    expect(dialogServiceMock.open).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        data: expect.objectContaining({ message: expect.stringContaining('um') }),
      }),
    );
    expect(targetVocabularyApiMock.rejectTargetVocabularyUse).not.toHaveBeenCalled();
  });
});
