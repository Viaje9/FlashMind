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

  it('單筆加入後保留已使用分頁與偏好', () => {
    const item = { id: 'word', term: 'watch', status: 'USED' } as TargetVocabularyItem;
    const added = { ...item, status: 'ADDED' } as TargetVocabularyItem;
    component.setFilter('USED');
    component.items.set([item]);
    dialogServiceMock.open.mockReturnValue({ afterClosed: () => of(added) });
    component.openAddToDeck(item);
    expect(component.items()).toEqual([added]);
    expect(component.activeFilter()).toBe('USED');
    expect(localStorage.getItem('flashmind.target-vocabulary.filter')).toBe('USED');
  });

  it('全選只包含目前搜尋的已使用單字，切分頁清除勾選', () => {
    component.setFilter('USED');
    component.items.set([
      { id: '1', term: 'watch', zhMeaning: '觀看', status: 'USED' },
      { id: '2', term: 'normal', zhMeaning: '正常的', status: 'USED' },
      { id: '3', term: 'watchful', zhMeaning: '警覺的', status: 'PRACTICING' },
    ] as TargetVocabularyItem[]);
    component.query.set('watch');
    component.toggleSelectAll();
    expect([...component.selectedIds()]).toEqual(['1']);
    component.setFilter('ADDED');
    expect(component.selectedIds().size).toBe(0);
  });

  it('批次部分完成返回時只移除成功勾選，失敗項目保留', () => {
    const items = [
      { id: '1', term: 'watch', zhMeaning: '觀看', status: 'USED' },
      { id: '2', term: 'normal', zhMeaning: '正常的', status: 'USED' },
    ] as TargetVocabularyItem[];
    component.setFilter('USED');
    component.items.set(items);
    component.toggleSelectAll();
    dialogServiceMock.open.mockReturnValue({
      afterClosed: () => of([{ ...items[0], status: 'ADDED' }]),
    });
    component.openBatchAddToDeck();
    expect(component.selectedItems().map((item) => item.id)).toEqual(['2']);
    expect(component.activeFilter()).toBe('USED');
  });
});
