import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  Configuration,
  TopicConversationCorrectionStatus,
  TopicConversationRole,
  TopicConversationsService,
  type TopicConversationMessage,
  type TopicConversationSessionDetail,
  type TopicConversationSessionSummary,
} from '@flashmind/api-client';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SKIP_LOADING } from '../../interceptors/loading.interceptor';
import { TopicConversationStore } from './topic-conversation.store';

const topic = {
  id: 'topic-1',
  title: '在飯店辦理入住',
  scenario: '你抵達預訂的飯店，準備向櫃檯人員辦理入住。',
  createdAt: '2026-07-12T08:00:00.000Z',
  updatedAt: '2026-07-12T08:00:00.000Z',
};

const openingMessage: TopicConversationMessage = {
  id: 'assistant-1',
  role: TopicConversationRole.Assistant,
  content: 'Welcome! Do you have a reservation?',
  correction: null,
  createdAt: '2026-07-12T08:00:01.000Z',
};

const initialSession: TopicConversationSessionDetail = {
  id: 'session-1',
  topic,
  messages: [openingMessage],
  createdAt: '2026-07-12T08:00:00.000Z',
  updatedAt: '2026-07-12T08:00:01.000Z',
};

describe('TopicConversationStore', () => {
  let store: TopicConversationStore;
  let api: {
    listTopicConversations: ReturnType<typeof vi.fn>;
    createTopicConversation: ReturnType<typeof vi.fn>;
    getTopicConversation: ReturnType<typeof vi.fn>;
    createTopicConversationMessage: ReturnType<typeof vi.fn>;
    createTopicConversationHint: ReturnType<typeof vi.fn>;
    replayTopicConversation: ReturnType<typeof vi.fn>;
  };
  let http: { post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      listTopicConversations: vi.fn(),
      createTopicConversation: vi.fn(),
      getTopicConversation: vi.fn(),
      createTopicConversationMessage: vi.fn(),
      createTopicConversationHint: vi.fn(),
      replayTopicConversation: vi.fn(),
    };
    http = {
      post: vi.fn((url: string) =>
        url.endsWith('/draft')
          ? of({
              data: {
                title: topic.title,
                scenario: topic.scenario,
                openingMessage: openingMessage.content,
              },
            })
          : of({ data: initialSession }),
      ),
      delete: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TopicConversationStore,
        {
          provide: TopicConversationsService,
          useValue: api,
        },
        {
          provide: Configuration,
          useValue: new Configuration({ basePath: '/api' }),
        },
        { provide: HttpClient, useValue: http },
      ],
    });

    store = TestBed.inject(TopicConversationStore);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('應只建立未持久化的新主題草稿與 AI 開場訊息', async () => {
    const result = await store.createConversation();

    expect(result?.id).toMatch(/^draft-/);
    expect(store.currentSession()?.topic.title).toBe(topic.title);
    expect(store.messages().map((message) => message.content)).toEqual([openingMessage.content]);
    expect(store.creating()).toBe(false);
    expect(http.post).toHaveBeenCalledWith(
      '/api/topic-conversations/draft',
      {},
      expect.objectContaining({ context: expect.anything() }),
    );
  });

  it('應依場次 ID 載入完整歷史與修正', async () => {
    const correctedUserMessage: TopicConversationMessage = {
      id: 'user-1',
      role: TopicConversationRole.User,
      content: 'I have reservation.',
      correction: {
        status: TopicConversationCorrectionStatus.Corrected,
        suggestedText: 'I have a reservation.',
        explanation: 'reservation 前需要冠詞 a。',
      },
      createdAt: '2026-07-12T08:01:00.000Z',
    };
    api.getTopicConversation.mockReturnValue(
      of({ data: { ...initialSession, messages: [openingMessage, correctedUserMessage] } }),
    );

    expect(await store.loadConversation('session-1')).toBe(true);
    expect(store.messages()[1].correction).toMatchObject({
      label: '建議修正',
      showDetails: true,
    });
    expect(store.loadingConversation()).toBe(false);
  });

  it('送出後應立即顯示使用者訊息，並逐步附加 AI reply delta', async () => {
    api.createTopicConversation.mockReturnValue(of({ data: initialSession }));
    api.createTopicConversationHint.mockReturnValue(
      of({ data: { suggestions: ['Try mentioning your name.'] } }),
    );
    await store.createConversation();
    await store.requestHint();

    const userMessage: TopicConversationMessage = {
      id: 'user-1',
      role: TopicConversationRole.User,
      content: 'I have reservation.',
      correction: {
        status: TopicConversationCorrectionStatus.Corrected,
        suggestedText: 'I have a reservation.',
        explanation: 'reservation 前需要冠詞 a。',
      },
      createdAt: '2026-07-12T08:01:00.000Z',
    };
    const assistantMessage: TopicConversationMessage = {
      id: 'assistant-2',
      role: TopicConversationRole.Assistant,
      content: 'Great. What name is the reservation under?',
      correction: null,
      createdAt: '2026-07-12T08:01:01.000Z',
    };
    let finishStream: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode('event: assistant_delta\ndata: {"delta":"Great. "}\n\n'),
              );
              finishStream = () => {
                controller.enqueue(
                  new TextEncoder().encode(
                    `event: assistant_delta\ndata: {"delta":"What name is the reservation under?"}\n\n` +
                      `event: result\ndata: ${JSON.stringify({ data: { userMessage, assistantMessage } })}\n\n`,
                  ),
                );
                controller.close();
              };
            },
          }),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      ),
    );

    const sendPromise = store.sendMessage('  I have reservation.  ');

    expect(store.sending()).toBe(true);
    await Promise.resolve();
    expect(store.messages().map((message) => message.content)).toEqual([
      openingMessage.content,
      'I have reservation.',
      '',
    ]);
    expect(store.messages().at(-1)?.streaming).toBe(true);

    for (let index = 0; index < 5; index += 1) {
      if (store.messages().at(-1)?.content) break;
      await Promise.resolve();
    }
    expect(store.messages().at(-1)?.content).toBe('Great. ');

    finishStream?.();
    expect(await sendPromise).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/topic-conversations/session-1/messages/stream',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ message: 'I have reservation.' }),
      }),
    );
    expect(store.messages().map((message) => message.id)).toEqual([
      'assistant-1',
      'user-1',
      'assistant-2',
    ]);
    expect(store.messages().at(-1)?.streaming).toBe(false);
    expect(store.hintSuggestions()).toEqual([]);
    expect(store.sending()).toBe(false);
  });

  it('正常聊天不應自動取得提示，只有主動要求時才呼叫 API', async () => {
    api.createTopicConversation.mockReturnValue(of({ data: initialSession }));
    api.createTopicConversationHint.mockReturnValue(
      of({ data: { suggestions: ['  Mention the booking name.  ', '', 'Show your passport.'] } }),
    );
    await store.createConversation();

    expect(api.createTopicConversationHint).not.toHaveBeenCalled();
    http.post.mockReturnValueOnce(
      of({ data: { suggestions: ['  Mention the booking name.  ', '', 'Show your passport.'] } }),
    );

    const suggestions = await store.requestHint();

    expect(http.post).toHaveBeenCalledWith(
      '/api/topic-conversations/draft/hint',
      expect.objectContaining({ title: topic.title }),
      expect.any(Object),
    );
    expect(suggestions).toEqual(['Mention the booking name.', 'Show your passport.']);
    expect(store.hintSuggestions()).toEqual(suggestions);
    expect(store.messages()).toHaveLength(1);
  });

  it('應使用 cursor 附加載入歷史，不覆蓋上一頁', async () => {
    const firstPage = historySummary('session-1', 'First message');
    const secondPage = historySummary('session-2', 'Second message');
    api.listTopicConversations
      .mockReturnValueOnce(
        of({ data: [firstPage], meta: { nextCursor: 'cursor-1', hasMore: true } }),
      )
      .mockReturnValueOnce(of({ data: [secondPage], meta: { nextCursor: null, hasMore: false } }));

    await store.loadHistory();
    await store.loadMoreHistory();

    expect(store.historyItems().map((item) => item.id)).toEqual(['session-1', 'session-2']);
    expect(api.listTopicConversations.mock.calls[0]?.slice(0, 4)).toEqual([
      undefined,
      20,
      undefined,
      undefined,
    ]);
    expect(api.listTopicConversations.mock.calls[1]?.slice(0, 4)).toEqual([
      'cursor-1',
      20,
      undefined,
      undefined,
    ]);
    expect(store.hasMoreHistory()).toBe(false);
  });

  it('刪除成功後應立即從歷史移除該對話', async () => {
    api.listTopicConversations.mockReturnValue(
      of({ data: [historySummary('session-1', 'First message')], meta: {} }),
    );
    http.delete.mockReturnValue(of(undefined));
    await store.loadHistory();

    expect(await store.deleteConversation('session-1')).toBe(true);
    expect(http.delete).toHaveBeenCalledWith(
      '/api/topic-conversations/session-1',
      expect.objectContaining({ context: expect.anything() }),
    );
    expect(store.historyItems()).toEqual([]);
  });

  it('應沿用既有主題建立新場次，不修改原場次', async () => {
    const replayedSession = {
      ...initialSession,
      id: 'session-2',
      messages: [{ ...openingMessage, id: 'assistant-replay' }],
    };
    api.replayTopicConversation.mockReturnValue(of({ data: replayedSession }));

    const result = await store.replayConversation('session-1');

    expect(api.replayTopicConversation).toHaveBeenCalledWith(
      'session-1',
      undefined,
      undefined,
      expect.any(Object),
    );
    expect(result?.id).toBe('session-2');
    expect(store.currentSession()?.id).toBe('session-2');
  });

  it('串流失敗時應保留已送出的暫存訊息並移除空白 AI 訊息', async () => {
    api.createTopicConversation.mockReturnValue(of({ data: initialSession }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('AI unavailable')));
    await store.createConversation();

    expect(await store.sendMessage('Hello')).toBe(false);
    expect(store.messages().map((message) => message.content)).toEqual([
      openingMessage.content,
      'Hello',
    ]);
    expect(store.error()).toBe('訊息送出失敗，請稍後再試。');
    expect(store.sending()).toBe(false);
  });
});

function historySummary(id: string, preview: string): TopicConversationSessionSummary {
  return {
    id,
    topic,
    messageCount: 3,
    lastMessagePreview: preview,
    createdAt: '2026-07-12T08:00:00.000Z',
    updatedAt: '2026-07-12T08:05:00.000Z',
  };
}
