import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CardsService,
  Configuration,
  DecksService,
  CollectionsService,
  type CollectionItem as ApiCollectionItem,
  type CollectionItemKind as ApiCollectionItemKind,
  type CollectionSuggestion as ApiCollectionSuggestion,
  type CollectionSuggestedCard as ApiCollectionSuggestedCard,
  type CreateCollectionItemRequest,
} from '@flashmind/api-client';

import {
  type CollectionChatGroup,
  type CollectionDeckOption,
  type CollectionFilter,
  type CollectionItem,
  type CollectionItemKind,
  type CollectionSuggestion,
  type CollectionSuggestedCard,
  mapCollectionSuggestedCard,
  patchSuggestedCard as patchSuggestedCardList,
} from './collection-pack.domain';
import { SKIP_LOADING } from '../../interceptors/loading.interceptor';

@Injectable({ providedIn: 'root' })
export class CollectionPackStore {
  private readonly collectionsApi = inject(CollectionsService);
  private readonly cardsApi = inject(CardsService);
  private readonly decksApi = inject(DecksService);
  private readonly apiConfiguration = inject(Configuration);
  private readonly skipLoadingContext = new HttpContext().set(SKIP_LOADING, true);
  private readonly chatSessionId = signal<string | null>(null);

  readonly items = signal<CollectionItem[]>([]);
  readonly chatGroups = signal<CollectionChatGroup[]>([]);
  readonly deckOptions = signal<CollectionDeckOption[]>([]);
  readonly loading = signal(false);
  readonly chatLoading = signal(false);
  readonly deckLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly collectionCount = computed(() => this.items().length);
  readonly vocabularyCoverage = signal(0);

  async loadItems(filter: CollectionFilter = 'all', searchTerm = ''): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(
        this.collectionsApi.listCollectionItems(
          this.toApiKind(filter),
          searchTerm.trim() || undefined,
          undefined,
          50,
        ),
      );
      this.items.set(response.data.map((item) => this.mapItem(item)));
    } catch {
      this.errorMessage.set('收藏包讀取失敗，請稍後再試。');
    } finally {
      this.loading.set(false);
    }
  }

  async sendChatMessage(userText: string): Promise<void> {
    const normalized = userText.trim();
    if (!normalized) return;

    this.chatLoading.set(true);
    this.errorMessage.set(null);
    const groupId = `pending-${Date.now()}`;
    this.chatGroups.update((groups) => [
      ...groups,
      {
        id: groupId,
        userText: normalized,
        suggestions: [],
        suggestedCards: [],
      },
    ]);

    try {
      const sessionId = await this.ensureChatSession();
      const response = await this.createCollectionChatMessageStream(
        sessionId,
        normalized,
        (delta) => {
          this.patchChatGroup(groupId, {
            assistantText: `${this.findChatGroup(groupId)?.assistantText ?? ''}${delta}`,
          });
        },
      );
      this.patchChatGroup(groupId, {
        userText: response.data.userMessage,
        assistantText: response.data.assistantMessage,
        suggestions: this.mapSuggestions(response.data.candidates),
        suggestedCards: this.mapSuggestedCards(response.data.suggestedCards),
      });
    } catch {
      this.patchChatGroup(groupId, {
        assistantText: 'AI 暫時無法回覆，稍後再試一次。',
        suggestions: [],
        suggestedCards: [],
      });
      this.errorMessage.set('AI 回覆失敗，請稍後再試。');
    } finally {
      this.chatLoading.set(false);
    }
  }

  private async createCollectionChatMessageStream(
    sessionId: string,
    message: string,
    onAssistantDelta: (delta: string) => void,
  ): Promise<{
    data: {
      userMessage: string;
      assistantMessage: string;
      candidates: ApiCollectionSuggestion[];
      suggestedCards: ApiCollectionSuggestedCard[];
    };
  }> {
    const response = await fetch(
      `${this.apiBasePath()}/collections/chat-sessions/${encodeURIComponent(sessionId)}/messages/stream`,
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
      throw new Error('Collection chat stream failed');
    }

    return this.readCollectionChatMessageStream(response.body, onAssistantDelta);
  }

  private async readCollectionChatMessageStream(
    body: ReadableStream<Uint8Array>,
    onAssistantDelta: (delta: string) => void,
  ): Promise<{
    data: {
      userMessage: string;
      assistantMessage: string;
      candidates: ApiCollectionSuggestion[];
      suggestedCards: ApiCollectionSuggestedCard[];
    };
  }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: {
      data: {
        userMessage: string;
        assistantMessage: string;
        candidates: ApiCollectionSuggestion[];
        suggestedCards: ApiCollectionSuggestedCard[];
      };
    } | null = null;

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
          throw new Error(String(event.data['message'] ?? 'Collection chat stream failed'));
        }
      }

      if (done) break;
    }

    if (!result) {
      throw new Error('Collection chat stream ended without result');
    }

    return result;
  }

  async addSuggestion(groupId: string, suggestionId: string): Promise<void> {
    const suggestion = this.findSuggestion(groupId, suggestionId);
    if (!suggestion || suggestion.existing || suggestion.added) return;

    this.patchSuggestion(groupId, suggestionId, { added: true });

    try {
      const response = await firstValueFrom(
        this.collectionsApi.createCollectionItem(this.toCreateRequest(suggestion)),
      );
      const item = this.mapItem(response.data);
      this.items.update((items) => [item, ...items.filter((current) => current.id !== item.id)]);
      this.patchSuggestion(groupId, suggestionId, {
        added: true,
        collectionItemId: item.id,
      });
    } catch {
      this.patchSuggestion(groupId, suggestionId, { added: false });
      this.errorMessage.set('收藏加入失敗，請稍後再試。');
    }
  }

  async removeSuggestion(groupId: string, suggestionId: string): Promise<void> {
    const suggestion = this.findSuggestion(groupId, suggestionId);
    if (!suggestion || suggestion.existing || !suggestion.added) return;

    const collectionItemId = suggestion.collectionItemId;
    this.patchSuggestion(groupId, suggestionId, { added: false, collectionItemId: null });

    if (!collectionItemId) return;

    try {
      await firstValueFrom(this.collectionsApi.deleteCollectionItem(collectionItemId));
      this.items.update((items) => items.filter((item) => item.id !== collectionItemId));
    } catch {
      this.patchSuggestion(groupId, suggestionId, {
        added: true,
        collectionItemId,
      });
      this.errorMessage.set('收藏移除失敗，請稍後再試。');
    }
  }

  async loadDeckOptions(): Promise<void> {
    if (this.deckOptions().length > 0) return;

    this.deckLoading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(this.decksApi.listDecks());
      this.deckOptions.set(response.data.map((deck) => ({ id: deck.id, name: deck.name })));
    } catch {
      this.errorMessage.set('牌組讀取失敗，請稍後再試。');
    } finally {
      this.deckLoading.set(false);
    }
  }

  async addSuggestedCard(
    groupId: string,
    suggestedCardId: string,
    deck: CollectionDeckOption,
    cardData?: {
      front: string;
      meanings: CollectionSuggestedCard['meanings'];
    },
  ): Promise<boolean> {
    const suggestedCard = this.findSuggestedCard(groupId, suggestedCardId);
    if (!suggestedCard || suggestedCard.status === 'existing' || suggestedCard.status === 'added') {
      return false;
    }

    this.patchSuggestedCard(groupId, suggestedCardId, {
      status: 'adding',
      deckId: deck.id,
      deckName: deck.name,
    });

    try {
      await firstValueFrom(
        this.cardsApi.createCard(deck.id, {
          front: (cardData?.front ?? suggestedCard.front).trim(),
          meanings: (cardData?.meanings ?? suggestedCard.meanings).map((meaning) => ({
            zhMeaning: meaning.zhMeaning,
            enExample: meaning.enExample || undefined,
            zhExample: meaning.zhExample || undefined,
          })),
        }),
      );
      this.patchSuggestedCard(groupId, suggestedCardId, {
        added: true,
        status: 'added',
        deckId: deck.id,
        deckName: deck.name,
      });
      return true;
    } catch {
      this.patchSuggestedCard(groupId, suggestedCardId, {
        status: 'error',
        deckId: deck.id,
        deckName: deck.name,
      });
      this.errorMessage.set('單字卡新增失敗，請稍後再試。');
      return false;
    }
  }

  private async ensureChatSession(): Promise<string> {
    const existingSessionId = this.chatSessionId();
    if (existingSessionId) return existingSessionId;

    const response = await firstValueFrom(
      this.collectionsApi.createCollectionChatSession('body', false, {
        context: this.skipLoadingContext,
      }),
    );
    this.chatSessionId.set(response.data.id);

    return response.data.id;
  }

  startNewChat(): void {
    this.chatSessionId.set(null);
    this.chatGroups.set([]);
    this.errorMessage.set(null);
  }

  private findSuggestion(groupId: string, suggestionId: string): CollectionSuggestion | undefined {
    return this.chatGroups()
      .find((group) => group.id === groupId)
      ?.suggestions.find((suggestion) => suggestion.id === suggestionId);
  }

  private findChatGroup(groupId: string): CollectionChatGroup | undefined {
    return this.chatGroups().find((group) => group.id === groupId);
  }

  private findSuggestedCard(
    groupId: string,
    suggestedCardId: string,
  ): CollectionSuggestedCard | undefined {
    return this.chatGroups()
      .find((group) => group.id === groupId)
      ?.suggestedCards.find((card) => card.id === suggestedCardId);
  }

  private patchChatGroup(groupId: string, patch: Partial<CollectionChatGroup>): void {
    this.chatGroups.update((groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    );
  }

  private patchSuggestion(
    groupId: string,
    suggestionId: string,
    patch: Partial<CollectionSuggestion>,
  ): void {
    this.chatGroups.update((groups) =>
      groups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              suggestions: group.suggestions.map((suggestion) =>
                suggestion.id === suggestionId ? { ...suggestion, ...patch } : suggestion,
              ),
            },
      ),
    );
  }

  private patchSuggestedCard(
    groupId: string,
    suggestedCardId: string,
    patch: Partial<CollectionSuggestedCard>,
  ): void {
    this.chatGroups.update((groups) =>
      groups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              suggestedCards: patchSuggestedCardList(group.suggestedCards, suggestedCardId, patch),
            },
      ),
    );
  }

  private parseSseEvent(
    eventText: string,
  ): { event: string; data: Record<string, unknown> } | null {
    const event = eventText
      .split('\n')
      .find((line) => line.startsWith('event:'))
      ?.slice('event:'.length)
      .trim();
    const data = eventText
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');

    if (!event || !data) return null;

    return {
      event,
      data: JSON.parse(data) as Record<string, unknown>,
    };
  }

  private apiBasePath(): string {
    return this.apiConfiguration.basePath ?? '/api';
  }

  private toApiKind(filter: CollectionFilter): ApiCollectionItemKind | undefined {
    return filter === 'all' ? undefined : filter;
  }

  private mapItem(item: ApiCollectionItem): CollectionItem {
    return {
      id: item.id,
      kind: item.kind as CollectionItemKind,
      text: item.text,
      meaning: item.meaning,
      sourceWords: item.sourceWords,
      sourceCards: item.sourceCards?.map((card) => ({
        id: card.id,
        word: card.text,
        meaning: card.meaning,
      })),
      breakdownItems: item.breakdownItems.map((chunk) => ({
        id: chunk.id,
        kind: chunk.kind as Exclude<CollectionItemKind, 'sentence'>,
        text: chunk.text,
        meaning: chunk.meaning,
        sourceWord: chunk.sourceWord ?? undefined,
      })),
      relatedChunks: item.relatedChunks.map((chunk) => ({
        id: chunk.id,
        kind: chunk.kind as Exclude<CollectionItemKind, 'sentence'>,
        text: chunk.text,
        meaning: chunk.meaning,
        sourceWord: chunk.sourceWord ?? undefined,
      })),
      relatedSentences: item.relatedSentences.map((sentence) => ({
        id: sentence.id,
        text: sentence.text,
        meaning: sentence.meaning,
      })),
    };
  }

  private mapSuggestions(suggestions: ApiCollectionSuggestion[]): CollectionSuggestion[] {
    const visibleSuggestions: CollectionSuggestion[] = [];
    const seen = new Set<string>();

    for (const suggestion of suggestions) {
      const mappedSuggestion = this.mapSuggestion(suggestion);
      this.pushUniqueSuggestion(visibleSuggestions, seen, mappedSuggestion);
    }

    return visibleSuggestions;
  }

  private mapSuggestedCards(cards: ApiCollectionSuggestedCard[]): CollectionSuggestedCard[] {
    return cards
      .map((card) => mapCollectionSuggestedCard(card))
      .filter((card): card is CollectionSuggestedCard => Boolean(card));
  }

  private pushUniqueSuggestion(
    suggestions: CollectionSuggestion[],
    seen: Set<string>,
    suggestion: CollectionSuggestion,
  ): void {
    const key = `${suggestion.kind}:${suggestion.text.trim().toLowerCase()}`;
    if (seen.has(key)) return;

    seen.add(key);
    suggestions.push(suggestion);
  }

  private mapSuggestion(suggestion: ApiCollectionSuggestion): CollectionSuggestion {
    return {
      id: suggestion.id,
      kind: suggestion.kind as CollectionItemKind,
      text: suggestion.text,
      meaning: suggestion.meaning,
      sourceWord: suggestion.sourceWord ?? suggestion.sourceCards?.[0]?.text ?? undefined,
      sourceCards: suggestion.sourceCards?.map((card) => ({
        id: card.id,
        word: card.text,
        meaning: card.meaning,
      })),
      sourceCardIds: suggestion.sourceCards?.map((card) => card.id) ?? [],
      existing: suggestion.existing,
      added: suggestion.added,
      collectionItemId: suggestion.collectionItemId ?? null,
      relatedCandidates: [],
    };
  }

  private toCreateRequest(suggestion: CollectionSuggestion): CreateCollectionItemRequest {
    return {
      kind: suggestion.kind,
      text: suggestion.text,
      meaning: suggestion.meaning,
      sourceCardIds:
        suggestion.sourceCards?.map((card) => card.id) ?? suggestion.sourceCardIds ?? [],
      relatedCandidates: [],
    };
  }
}
