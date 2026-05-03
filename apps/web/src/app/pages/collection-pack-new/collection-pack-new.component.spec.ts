import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AIService, CardsService, CollectionsService, DecksService } from '@flashmind/api-client';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';
import { TtsStore } from '../../components/tts/tts.store';
import { SKIP_LOADING } from '../../interceptors/loading.interceptor';
import { CollectionPackNewComponent } from './collection-pack-new.component';

describe('CollectionPackNewComponent', () => {
  let component: CollectionPackNewComponent;
  let store: CollectionPackStore;
  let collectionsApiMock: {
    createCollectionChatSession: ReturnType<typeof vi.fn>;
    createCollectionChatMessage: ReturnType<typeof vi.fn>;
    createCollectionItem: ReturnType<typeof vi.fn>;
    deleteCollectionItem: ReturnType<typeof vi.fn>;
  };
  let cardsApiMock: {
    createCard: ReturnType<typeof vi.fn>;
  };
  let decksApiMock: {
    listDecks: ReturnType<typeof vi.fn>;
  };
  let aiApiMock: {
    generateCardContent: ReturnType<typeof vi.fn>;
  };
  let ttsStoreMock: {
    isPlaying: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    collectionsApiMock = {
      createCollectionChatSession: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'session-1',
            providerThreadId: 'thread-1',
            title: null,
            createdAt: '2026-05-02T00:00:00.000Z',
            updatedAt: '2026-05-02T00:00:00.000Z',
          },
        }),
      ),
      createCollectionChatMessage: vi.fn().mockReturnValue(
        of({
          data: {
            sessionId: 'session-1',
            userMessage: '我想延期會議',
            assistantMessage: '可以這樣說，也可以收藏這個搭配詞。',
            intent: 'analyze_sentence',
            candidates: [
              {
                id: 'suggestion-delay-meeting',
                kind: 'sentence',
                text: 'I need to postpone the meeting.',
                meaning: '我需要延期會議。',
                sourceWord: null,
                existing: false,
                added: false,
                sourceCards: [],
                collectionItemId: null,
                relatedCandidates: [
                  {
                    kind: 'collocation',
                    text: 'postpone the meeting',
                    meaning: '延期會議',
                    type: 'sentence_has_collocation',
                    sourceCardIds: [],
                  },
                  {
                    kind: 'clause',
                    text: 'because the client changed the schedule',
                    meaning: '因為客戶改了時程',
                    type: 'sentence_has_clause',
                    sourceCardIds: [],
                  },
                ],
              },
            ],
            suggestedCards: [
              {
                id: 'suggest-restaurant',
                front: 'restaurant',
                meanings: [
                  {
                    zhMeaning: '餐廳',
                    enExample: 'I need to book a table at the restaurant.',
                    zhExample: '我需要在那間餐廳訂位。',
                  },
                ],
                reason: '這是句子的主要情境字，目前找不到對應單字卡。',
                existingCardId: null,
                added: false,
              },
            ],
          },
        }),
      ),
      createCollectionItem: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'collection-postpone-meeting',
            kind: 'collocation',
            text: 'postpone the meeting',
            meaning: '延期會議',
            sourceWords: ['meeting'],
            breakdownItems: [],
            relatedChunks: [],
            relatedSentences: [],
            createdAt: '2026-05-02T00:00:00.000Z',
            updatedAt: '2026-05-02T00:00:00.000Z',
          },
        }),
      ),
      deleteCollectionItem: vi.fn().mockReturnValue(of({})),
    };
    cardsApiMock = {
      createCard: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'card-restaurant',
            front: 'restaurant',
            meanings: [],
            createdAt: '2026-05-02T00:00:00.000Z',
            updatedAt: '2026-05-02T00:00:00.000Z',
          },
        }),
      ),
    };
    decksApiMock = {
      listDecks: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'deck-travel',
              name: 'Travel English',
              newCount: 0,
              reviewCount: 0,
              totalCount: 0,
              completedCount: 0,
              progress: 0,
              dailyNewCards: 20,
              dailyReviewCards: 100,
              todayNewStudied: 0,
              todayReviewStudied: 0,
            },
          ],
        }),
      ),
    };
    aiApiMock = {
      generateCardContent: vi.fn().mockReturnValue(
        of({
          data: {
            meanings: [
              {
                zhMeaning: '餐廳；飯店',
                enExample: 'This restaurant gets busy on weekends.',
                zhExample: '這間餐廳週末會很忙。',
              },
            ],
          },
        }),
      ),
    };
    ttsStoreMock = {
      isPlaying: vi.fn().mockReturnValue(false),
      play: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        CollectionPackStore,
        {
          provide: CollectionsService,
          useValue: collectionsApiMock,
        },
        {
          provide: CardsService,
          useValue: cardsApiMock,
        },
        {
          provide: DecksService,
          useValue: decksApiMock,
        },
        {
          provide: AIService,
          useValue: aiApiMock,
        },
        {
          provide: TtsStore,
          useValue: ttsStoreMock,
        },
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    });

    store = TestBed.inject(CollectionPackStore);
    component = TestBed.runInInjectionContext(() => new CollectionPackNewComponent());
  });

  it('送出文字後應追加 API 對話與建議', async () => {
    component.inputControl.setValue('我想延期會議');

    await component.onSubmit();

    expect(store.chatGroups().at(-1)?.userText).toBe('我想延期會議');
    expect(
      store
        .chatGroups()
        .at(-1)
        ?.suggestions.map((item) => item.text),
    ).toEqual([
      'I need to postpone the meeting.',
      'postpone the meeting',
      'because the client changed the schedule',
    ]);
    expect(component.inputControl.value).toBe('');
    expect(
      collectionsApiMock.createCollectionChatSession.mock.calls[0]?.[2].context.get(SKIP_LOADING),
    ).toBe(true);
    expect(
      collectionsApiMock.createCollectionChatMessage.mock.calls[0]?.[4].context.get(SKIP_LOADING),
    ).toBe(true);
  });

  it('送出後應先顯示使用者訊息再等待 AI 回覆', async () => {
    const chatResponse = new Subject<unknown>();
    collectionsApiMock.createCollectionChatMessage.mockReturnValue(chatResponse.asObservable());
    component.inputControl.setValue('我想說明專案延期');

    const submitPromise = component.onSubmit();

    expect(component.inputControl.value).toBe('');
    expect(store.chatLoading()).toBe(true);
    expect(store.chatGroups()).toEqual([
      {
        id: expect.stringMatching(/^pending-/),
        userText: '我想說明專案延期',
        suggestions: [],
        suggestedCards: [],
      },
    ]);

    for (let index = 0; index < 5; index += 1) {
      if (collectionsApiMock.createCollectionChatMessage.mock.calls.length > 0) break;
      await Promise.resolve();
    }
    expect(collectionsApiMock.createCollectionChatMessage).toHaveBeenCalled();

    chatResponse.next({
      data: {
        sessionId: 'session-1',
        userMessage: '我想說明專案延期',
        assistantMessage: '可以從 delay the project 開始練習。',
        intent: 'analyze_sentence',
        candidates: [],
        suggestedCards: [],
      },
    });
    chatResponse.complete();
    await submitPromise;

    expect(store.chatGroups()[0].assistantText).toBe('可以從 delay the project 開始練習。');
    expect(store.chatLoading()).toBe(false);
  });

  it('加入與移除建議時應同步 API 收藏狀態', async () => {
    component.inputControl.setValue('我想延期會議');
    await component.onSubmit();

    const group = store.chatGroups()[0];
    const suggestion = group.suggestions.find((item) => !item.existing);

    expect(suggestion).toBeDefined();
    if (!suggestion) return;

    const initialCount = store.items().length;
    await component.onToggleSuggestion(group.id, suggestion);

    expect(store.items().length).toBe(initialCount + 1);
    expect(store.chatGroups()[0].suggestions.find((item) => item.id === suggestion.id)?.added).toBe(
      true,
    );

    const addedSuggestion = store
      .chatGroups()[0]
      .suggestions.find((item) => item.id === suggestion.id);
    expect(addedSuggestion).toBeDefined();
    if (!addedSuggestion) return;

    await component.onToggleSuggestion(group.id, addedSuggestion);

    expect(store.items().length).toBe(initialCount);
    expect(store.chatGroups()[0].suggestions.find((item) => item.id === suggestion.id)?.added).toBe(
      false,
    );
  });

  it('可從建議單字選擇牌組並預填新增快閃卡', async () => {
    component.inputControl.setValue('我需要在餐廳訂滿之前先訂位');
    await component.onSubmit();

    const group = store.chatGroups()[0];
    const suggestedCard = group.suggestedCards[0];

    expect(suggestedCard.front).toBe('restaurant');

    await component.onAddSuggestedCard(group.id, suggestedCard);

    expect(decksApiMock.listDecks).toHaveBeenCalled();
    expect(component.deckPickerContext()?.suggestedCard.id).toBe('suggest-restaurant');
    expect(component.selectedDeckId()).toBe('deck-travel');

    component.onConfirmDeckPicker();

    expect(component.flashcardContext()?.deck.name).toBe('Travel English');
    expect(component.flashcardFront()).toBe('restaurant');
    expect(component.flashcardMeanings()[0]).toEqual({
      zhMeaning: '餐廳',
      enExample: 'I need to book a table at the restaurant.',
      zhExample: '我需要在那間餐廳訂位。',
    });

    await component.onSaveFlashcard();

    expect(cardsApiMock.createCard).toHaveBeenCalledWith('deck-travel', {
      front: 'restaurant',
      meanings: [
        {
          zhMeaning: '餐廳',
          enExample: 'I need to book a table at the restaurant.',
          zhExample: '我需要在那間餐廳訂位。',
        },
      ],
    });
    expect(
      store.chatGroups()[0].suggestedCards.find((card) => card.id === 'suggest-restaurant')?.status,
    ).toBe('added');
    expect(component.flashcardContext()).toBeNull();
  });

  it('新增快閃卡表單應可播放英文例句語音', async () => {
    component.inputControl.setValue('我需要在餐廳訂滿之前先訂位');
    await component.onSubmit();

    const group = store.chatGroups()[0];
    const suggestedCard = group.suggestedCards[0];
    await component.onAddSuggestedCard(group.id, suggestedCard);
    component.onConfirmDeckPicker();

    const example = component.flashcardMeanings()[0].enExample;

    component.onPlayFlashcardSentenceAudio(example);

    expect(ttsStoreMock.play).toHaveBeenCalledWith('I need to book a table at the restaurant.');
  });

  it('新增快閃卡表單應可用 AI 生成詞義與例句', async () => {
    component.inputControl.setValue('我需要在餐廳訂滿之前先訂位');
    await component.onSubmit();

    const group = store.chatGroups()[0];
    const suggestedCard = group.suggestedCards[0];
    await component.onAddSuggestedCard(group.id, suggestedCard);
    component.onConfirmDeckPicker();

    expect(component.canFlashcardAiGenerate()).toBe(true);

    await component.onFlashcardAiGenerate();

    expect(aiApiMock.generateCardContent).toHaveBeenCalledWith({ text: 'restaurant' });
    expect(component.flashcardMeanings()).toEqual([
      {
        zhMeaning: '餐廳；飯店',
        enExample: 'This restaurant gets busy on weekends.',
        zhExample: '這間餐廳週末會很忙。',
      },
    ]);
  });

  it('沒有牌組時應提示先建立牌組且不開啟新增表單', async () => {
    decksApiMock.listDecks.mockReturnValue(of({ data: [] }));
    component.inputControl.setValue('我需要在餐廳訂滿之前先訂位');
    await component.onSubmit();

    const group = store.chatGroups()[0];
    const suggestedCard = group.suggestedCards[0];

    await component.onAddSuggestedCard(group.id, suggestedCard);

    expect(component.deckPickerNotice()).toBe('目前還沒有可加入的牌組，請先建立牌組後再新增單字。');
    expect(component.deckPickerContext()).toBeNull();
    expect(component.flashcardContext()).toBeNull();
    expect(cardsApiMock.createCard).not.toHaveBeenCalled();
  });

  it('新對話應清空目前訊息並建立下一個聊天 session', async () => {
    component.inputControl.setValue('我想延期會議');
    await component.onSubmit();

    expect(store.chatGroups()).toHaveLength(1);

    component.inputControl.setValue('暫存文字');
    component.onStartNewChat();

    expect(store.chatGroups()).toHaveLength(0);
    expect(component.inputControl.value).toBe('');
  });
});
