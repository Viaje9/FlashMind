import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import {
  DecksService,
  SpeakingService,
  TargetVocabularyService,
  type TargetVocabularyItem,
} from '@flashmind/api-client';
import { DIALOG_CONFIG, DialogRef } from '@flashmind/ui';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchAddToDeckDialogComponent } from './batch-add-to-deck-dialog.component';

describe('批次加入目標單字', () => {
  const api = { addTargetVocabularyToDeck: vi.fn() };
  const speaking = { translateSpeakingText: vi.fn() };
  const decksApi = { listDecks: vi.fn() };
  const dialog = { close: vi.fn() };
  let component: BatchAddToDeckDialogComponent;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetAllMocks();
    decksApi.listDecks.mockReturnValue(of({ data: [{ id: 'deck', name: '練習' }] }));
    TestBed.configureTestingModule({
      providers: [
        { provide: DecksService, useValue: decksApi },
        { provide: SpeakingService, useValue: speaking },
        { provide: TargetVocabularyService, useValue: api },
        { provide: DialogRef, useValue: dialog },
        {
          provide: DIALOG_CONFIG,
          useValue: {
            data: {
              items: ['watch', 'normal', 'pace'].map(
                (term, i) =>
                  ({
                    id: String(i),
                    term,
                    zhMeaning: '中文',
                    status: 'USED',
                    naturalSentence: i === 2 ? null : `Use ${term}.`,
                  }) as TargetVocabularyItem,
              ),
            },
          },
        },
      ],
    });
    component = TestBed.runInInjectionContext(() => new BatchAddToDeckDialogComponent());
    await component.ngOnInit();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('略過無例句與已填中文，不覆蓋手動備妥的翻譯', async () => {
    component.model.update((model) => ({
      ...model,
      entries: model.entries.map((entry) =>
        entry.id === '0' ? { ...entry, zhExample: '自訂翻譯' } : entry,
      ),
    }));
    speaking.translateSpeakingText.mockReturnValue(of({ data: { translatedText: '正常' } }));
    await component.translateAll();
    expect(speaking.translateSpeakingText).toHaveBeenCalledTimes(1);
    expect(speaking.translateSpeakingText).toHaveBeenCalledWith({ text: 'Use normal.' });
    expect(component.model().entries.map((entry) => entry.zhExample)).toEqual([
      '自訂翻譯',
      '正常',
      '',
    ]);
  });

  it('翻譯部分失敗保留成功內容，重試只送缺少中文的句子', async () => {
    speaking.translateSpeakingText
      .mockReturnValueOnce(of({ data: { translatedText: '觀看' } }))
      .mockReturnValueOnce(throwError(() => new Error('失敗')));
    await component.translateAll();
    expect(component.error()).toContain('1 個');
    speaking.translateSpeakingText.mockReturnValue(of({ data: { translatedText: '正常' } }));
    await component.translateAll();
    expect(speaking.translateSpeakingText).toHaveBeenCalledTimes(3);
    expect(component.model().entries[0].zhExample).toBe('觀看');
  });

  it('翻譯中不得送出或重複翻譯', async () => {
    const response = new Subject<{ data: { translatedText: string } }>();
    speaking.translateSpeakingText
      .mockReturnValueOnce(response)
      .mockReturnValue(of({ data: { translatedText: '中文' } }));
    const work = component.translateAll();
    await component.onConfirm();
    await component.translateAll();
    component.onCancel();
    expect(api.addTargetVocabularyToDeck).not.toHaveBeenCalled();
    expect(speaking.translateSpeakingText).toHaveBeenCalledTimes(1);
    expect(dialog.close).not.toHaveBeenCalled();
    response.next({ data: { translatedText: '觀看' } });
    await work;
  });

  it('部分加入成功後取消，仍回傳成功項目讓清單更新', async () => {
    const added = { id: '0', term: 'watch', status: 'ADDED' };
    api.addTargetVocabularyToDeck
      .mockReturnValueOnce(of({ data: added }))
      .mockReturnValue(throwError(() => new Error('失敗')));
    await component.onConfirm();
    expect(component.pendingEntries()).toHaveLength(2);
    expect(dialog.close).not.toHaveBeenCalled();
    component.onCancel();
    expect(dialog.close).toHaveBeenCalledWith([added]);
    expect(localStorage.getItem('flashmind.target-vocabulary.last-deck-id')).toBe('deck');
  });

  it('沒有牌組時不能送出', async () => {
    component.decks.set([]);
    await component.onConfirm();
    expect(api.addTargetVocabularyToDeck).not.toHaveBeenCalled();
  });

  it('無例句也可加入，且送出已填的中文例句', async () => {
    component.model.update((model) => ({
      ...model,
      entries: model.entries.map((entry) =>
        entry.id === '0' ? { ...entry, zhExample: '觀看' } : entry,
      ),
    }));
    api.addTargetVocabularyToDeck.mockImplementation((id: string) =>
      of({ data: { id, status: 'ADDED' } }),
    );
    await component.onConfirm();
    expect(api.addTargetVocabularyToDeck).toHaveBeenCalledWith(
      '0',
      expect.objectContaining({ zhExample: '觀看', naturalSentence: 'Use watch.' }),
    );
    expect(api.addTargetVocabularyToDeck).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({ naturalSentence: undefined, zhExample: undefined }),
    );
    expect(dialog.close).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: '2' })]),
    );
  });
});
