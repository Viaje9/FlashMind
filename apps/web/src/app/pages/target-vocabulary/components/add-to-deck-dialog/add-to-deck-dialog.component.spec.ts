import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DecksService,
  SpeakingService,
  TargetVocabularyService,
  type TargetVocabularyItem,
} from '@flashmind/api-client';
import { DIALOG_CONFIG, DialogRef } from '@flashmind/ui';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TtsStore } from '../../../../components/tts/tts.store';
import { AddToDeckDialogComponent } from './add-to-deck-dialog.component';

describe('AddToDeckDialogComponent', () => {
  const speakingApiMock = { translateSpeakingText: vi.fn() };
  const targetVocabularyApiMock = { addTargetVocabularyToDeck: vi.fn() };
  const item = {
    id: 'target-1',
    term: 'function',
    zhMeaning: '功能',
    naturalSentence: 'It depends on what kind of function the node tree needs.',
  } as TargetVocabularyItem;

  let component: AddToDeckDialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DecksService, useValue: { listDecks: vi.fn(() => of({ data: [] })) } },
        { provide: SpeakingService, useValue: speakingApiMock },
        { provide: TargetVocabularyService, useValue: targetVocabularyApiMock },
        { provide: TtsStore, useValue: { playingText: signal(null), play: vi.fn() } },
        { provide: DialogRef, useValue: { close: vi.fn() } },
        { provide: DIALOG_CONFIG, useValue: { data: { item } } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AddToDeckDialogComponent());
    vi.clearAllMocks();
  });

  it('只翻譯英文例句並保留其他卡片內容', async () => {
    speakingApiMock.translateSpeakingText.mockReturnValue(
      of({ data: { translatedText: '這取決於節點樹需要什麼樣的功能。' } }),
    );

    await component.onTranslateSentence(0);

    expect(speakingApiMock.translateSpeakingText).toHaveBeenCalledWith({
      text: 'It depends on what kind of function the node tree needs.',
    });
    expect(component.front()).toBe('function');
    expect(component.meanings()[0]).toEqual({
      zhMeaning: '功能',
      enExample: 'It depends on what kind of function the node tree needs.',
      zhExample: '這取決於節點樹需要什麼樣的功能。',
    });
  });

  it('加入牌組時應送出英文例句及其中文翻譯', () => {
    component.form.controls.deckId.setValue('deck-1');
    component.meanings.set([
      {
        zhMeaning: '功能',
        enExample: 'This function is useful.',
        zhExample: '這個功能很實用。',
      },
    ]);
    targetVocabularyApiMock.addTargetVocabularyToDeck.mockReturnValue(of({ data: item }));

    component.onConfirm();

    expect(targetVocabularyApiMock.addTargetVocabularyToDeck).toHaveBeenCalledWith('target-1', {
      deckId: 'deck-1',
      term: 'function',
      zhMeaning: '功能',
      naturalSentence: 'This function is useful.',
      zhExample: '這個功能很實用。',
    });
  });
});
