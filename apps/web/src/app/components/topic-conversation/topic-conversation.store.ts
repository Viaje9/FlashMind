import { HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Configuration,
  TopicConversationRole,
  TopicConversationsService,
  type TopicConversationMessageExchange,
} from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';
import { SKIP_LOADING } from '../../interceptors/loading.interceptor';
import {
  canSendTopicConversationMessage,
  mapTopicConversationHistoryItem,
  mapTopicConversationMessage,
  mapTopicConversationSession,
  type TopicConversationHistoryItem,
  type TopicConversationSessionView,
} from './topic-conversation.domain';

const HISTORY_PAGE_SIZE = 20;

interface TopicConversationStoreState {
  currentSession: TopicConversationSessionView | null;
  historyItems: TopicConversationHistoryItem[];
  nextCursor: string | null;
  hasMoreHistory: boolean;
  creating: boolean;
  loadingConversation: boolean;
  sending: boolean;
  hintLoading: boolean;
  loadingHistory: boolean;
  error: string | null;
  hintSuggestions: string[];
}

const initialState: TopicConversationStoreState = {
  currentSession: null,
  historyItems: [],
  nextCursor: null,
  hasMoreHistory: false,
  creating: false,
  loadingConversation: false,
  sending: false,
  hintLoading: false,
  loadingHistory: false,
  error: null,
  hintSuggestions: [],
};

@Injectable({ providedIn: 'root' })
export class TopicConversationStore {
  private readonly api = inject(TopicConversationsService);
  private readonly apiConfiguration = inject(Configuration);
  private readonly skipLoadingOptions = {
    context: new HttpContext().set(SKIP_LOADING, true),
  };
  private readonly state = signal<TopicConversationStoreState>(initialState);

  readonly currentSession = computed(() => this.state().currentSession);
  readonly messages = computed(() => this.state().currentSession?.messages ?? []);
  readonly historyItems = computed(() => this.state().historyItems);
  readonly creating = computed(() => this.state().creating);
  readonly loadingConversation = computed(() => this.state().loadingConversation);
  readonly sending = computed(() => this.state().sending);
  readonly hintLoading = computed(() => this.state().hintLoading);
  readonly loadingHistory = computed(() => this.state().loadingHistory);
  readonly error = computed(() => this.state().error);
  readonly hintSuggestions = computed(() => this.state().hintSuggestions);
  readonly hasMoreHistory = computed(() => this.state().hasMoreHistory);

  async createConversation(): Promise<TopicConversationSessionView | null> {
    if (this.state().creating) {
      return null;
    }

    this.state.update((state) => ({
      ...state,
      currentSession: null,
      creating: true,
      error: null,
      hintSuggestions: [],
    }));

    try {
      const response = await firstValueFrom(
        this.api.createTopicConversation(undefined, undefined, this.skipLoadingOptions),
      );
      const currentSession = mapTopicConversationSession(response.data);
      this.state.update((state) => ({ ...state, currentSession }));
      return currentSession;
    } catch {
      this.setError('建立新主題失敗，請稍後再試。');
      return null;
    } finally {
      this.state.update((state) => ({ ...state, creating: false }));
    }
  }

  async loadConversation(id: string): Promise<boolean> {
    const conversationId = id.trim();
    if (!conversationId || this.state().loadingConversation) {
      return false;
    }

    this.state.update((state) => ({
      ...state,
      currentSession: null,
      loadingConversation: true,
      error: null,
      hintSuggestions: [],
    }));

    try {
      const response = await firstValueFrom(
        this.api.getTopicConversation(
          conversationId,
          undefined,
          undefined,
          this.skipLoadingOptions,
        ),
      );
      const currentSession = mapTopicConversationSession(response.data);
      this.state.update((state) => ({ ...state, currentSession }));
      return true;
    } catch {
      this.setError('讀取主題對話失敗，請稍後再試。');
      return false;
    } finally {
      this.state.update((state) => ({ ...state, loadingConversation: false }));
    }
  }

  async sendMessage(message: string): Promise<boolean> {
    const currentSession = this.state().currentSession;
    if (!currentSession || !canSendTopicConversationMessage(message, this.state().sending)) {
      return false;
    }

    const normalized = message.trim();
    const conversationId = currentSession.id;
    const pendingId = `pending-${Date.now()}`;
    const pendingUserId = `${pendingId}-user`;
    const pendingAssistantId = `${pendingId}-assistant`;
    const createdAt = new Date().toISOString();
    this.state.update((state) => ({
      ...state,
      sending: true,
      error: null,
      hintSuggestions: [],
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            messages: [
              ...state.currentSession.messages,
              {
                id: pendingUserId,
                role: TopicConversationRole.User,
                content: normalized,
                correction: null,
                createdAt,
                streaming: false,
              },
              {
                id: pendingAssistantId,
                role: TopicConversationRole.Assistant,
                content: '',
                correction: null,
                createdAt,
                streaming: true,
              },
            ],
          }
        : null,
    }));

    try {
      const response = await this.createMessageStream(conversationId, normalized, (delta) => {
        this.patchMessage(pendingAssistantId, (current) => ({
          ...current,
          content: `${current.content}${delta}`,
        }));
      });
      const userMessage = mapTopicConversationMessage(response.data.userMessage);
      const assistantMessage = mapTopicConversationMessage(response.data.assistantMessage);

      this.state.update((state) => {
        if (state.currentSession?.id !== conversationId) {
          return state;
        }

        return {
          ...state,
          currentSession: {
            ...state.currentSession,
            messages: state.currentSession.messages.map((message) => {
              if (message.id === pendingUserId) return userMessage;
              if (message.id === pendingAssistantId) return assistantMessage;
              return message;
            }),
          },
        };
      });
      return true;
    } catch {
      this.removeMessage(pendingAssistantId);
      this.setError('訊息送出失敗，請稍後再試。');
      return false;
    } finally {
      this.state.update((state) => ({ ...state, sending: false }));
    }
  }

  async requestHint(): Promise<string[]> {
    const currentSession = this.state().currentSession;
    if (!currentSession || this.state().hintLoading) {
      return [];
    }

    const conversationId = currentSession.id;
    this.state.update((state) => ({
      ...state,
      hintLoading: true,
      error: null,
      hintSuggestions: [],
    }));

    try {
      const response = await firstValueFrom(
        this.api.createTopicConversationHint(
          conversationId,
          undefined,
          undefined,
          this.skipLoadingOptions,
        ),
      );
      const suggestions = response.data.suggestions
        .map((suggestion) => suggestion.trim())
        .filter(Boolean);
      this.state.update((state) => ({ ...state, hintSuggestions: suggestions }));
      return suggestions;
    } catch {
      this.setError('取得回應提示失敗，請稍後再試。');
      return [];
    } finally {
      this.state.update((state) => ({ ...state, hintLoading: false }));
    }
  }

  async loadHistory(): Promise<void> {
    await this.fetchHistory(true);
  }

  async loadMoreHistory(): Promise<void> {
    if (!this.state().hasMoreHistory) {
      return;
    }
    await this.fetchHistory(false);
  }

  async replayConversation(id: string): Promise<TopicConversationSessionView | null> {
    const conversationId = id.trim();
    if (!conversationId || this.state().creating) {
      return null;
    }

    this.state.update((state) => ({
      ...state,
      creating: true,
      error: null,
      hintSuggestions: [],
    }));

    try {
      const response = await firstValueFrom(
        this.api.replayTopicConversation(
          conversationId,
          undefined,
          undefined,
          this.skipLoadingOptions,
        ),
      );
      const currentSession = mapTopicConversationSession(response.data);
      this.state.update((state) => ({ ...state, currentSession }));
      return currentSession;
    } catch {
      this.setError('建立重練場次失敗，請稍後再試。');
      return null;
    } finally {
      this.state.update((state) => ({ ...state, creating: false }));
    }
  }

  clearError(): void {
    this.state.update((state) => ({ ...state, error: null }));
  }

  clearHint(): void {
    this.state.update((state) => ({ ...state, hintSuggestions: [] }));
  }

  private async createMessageStream(
    sessionId: string,
    message: string,
    onAssistantDelta: (delta: string) => void,
  ): Promise<{ data: TopicConversationMessageExchange }> {
    const response = await fetch(
      `${this.apiBasePath()}/topic-conversations/${encodeURIComponent(sessionId)}/messages/stream`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      },
    );

    if (!response.ok || !response.body) {
      throw new Error('Topic conversation stream failed');
    }

    return this.readMessageStream(response.body, onAssistantDelta);
  }

  private async readMessageStream(
    body: ReadableStream<Uint8Array>,
    onAssistantDelta: (delta: string) => void,
  ): Promise<{ data: TopicConversationMessageExchange }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: { data: TopicConversationMessageExchange } | null = null;

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const eventText of events) {
        const event = this.parseSseEvent(eventText);
        if (!event) continue;

        if (event.event === 'assistant_delta') {
          onAssistantDelta(String(event.data['delta'] ?? ''));
        } else if (event.event === 'result') {
          result = event.data as unknown as NonNullable<typeof result>;
        } else if (event.event === 'error') {
          throw new Error(String(event.data['message'] ?? 'Topic conversation stream failed'));
        }
      }

      if (done) break;
    }

    if (!result) {
      throw new Error('Topic conversation stream ended without result');
    }

    return result;
  }

  private parseSseEvent(
    eventText: string,
  ): { event: string; data: Record<string, unknown> } | null {
    const lines = eventText.split('\n');
    const event = lines
      .find((line) => line.startsWith('event:'))
      ?.slice('event:'.length)
      .trim();
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');

    if (!event || !data) return null;

    return {
      event,
      data: JSON.parse(data) as Record<string, unknown>,
    };
  }

  private patchMessage(
    messageId: string,
    patch: (
      message: TopicConversationSessionView['messages'][number],
    ) => TopicConversationSessionView['messages'][number],
  ): void {
    this.state.update((state) =>
      state.currentSession
        ? {
            ...state,
            currentSession: {
              ...state.currentSession,
              messages: state.currentSession.messages.map((message) =>
                message.id === messageId ? patch(message) : message,
              ),
            },
          }
        : state,
    );
  }

  private removeMessage(messageId: string): void {
    this.state.update((state) =>
      state.currentSession
        ? {
            ...state,
            currentSession: {
              ...state.currentSession,
              messages: state.currentSession.messages.filter((message) => message.id !== messageId),
            },
          }
        : state,
    );
  }

  private apiBasePath(): string {
    return this.apiConfiguration.basePath ?? '/api';
  }

  private async fetchHistory(reset: boolean): Promise<void> {
    if (this.state().loadingHistory || (!reset && !this.state().hasMoreHistory)) {
      return;
    }

    const cursor = reset ? undefined : (this.state().nextCursor ?? undefined);
    this.state.update((state) => ({
      ...state,
      loadingHistory: true,
      error: null,
      ...(reset
        ? {
            historyItems: [],
            nextCursor: null,
            hasMoreHistory: false,
          }
        : {}),
    }));

    try {
      const response = await firstValueFrom(
        this.api.listTopicConversations(
          cursor,
          HISTORY_PAGE_SIZE,
          undefined,
          undefined,
          this.skipLoadingOptions,
        ),
      );
      const historyItems = response.data.map(mapTopicConversationHistoryItem);
      this.state.update((state) => ({
        ...state,
        historyItems: reset ? historyItems : [...state.historyItems, ...historyItems],
        nextCursor: response.meta.nextCursor ?? null,
        hasMoreHistory: response.meta.hasMore ?? false,
      }));
    } catch {
      this.setError('讀取主題對話歷史失敗，請稍後再試。');
    } finally {
      this.state.update((state) => ({ ...state, loadingHistory: false }));
    }
  }

  private setError(error: string): void {
    this.state.update((state) => ({ ...state, error }));
  }
}
