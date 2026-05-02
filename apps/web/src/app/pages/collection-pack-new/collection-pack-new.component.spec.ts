import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CollectionsService } from '@flashmind/api-client';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';
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
            suggestedCards: [],
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

    TestBed.configureTestingModule({
      providers: [
        CollectionPackStore,
        {
          provide: CollectionsService,
          useValue: collectionsApiMock,
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
