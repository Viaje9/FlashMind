import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CollectionsService,
  type CollectionItem as ApiCollectionItem,
  type CollectionItemKind as ApiCollectionItemKind,
  type CollectionSaveRelatedCandidate,
  type CollectionSuggestion as ApiCollectionSuggestion,
  type CreateCollectionItemRequest,
} from '@flashmind/api-client';

import {
  type CollectionChatGroup,
  type CollectionFilter,
  type CollectionItem,
  type CollectionItemKind,
  type CollectionSuggestion,
} from './collection-pack.domain';

@Injectable({ providedIn: 'root' })
export class CollectionPackStore {
  private readonly collectionsApi = inject(CollectionsService);
  private readonly chatSessionId = signal<string | null>(null);

  readonly items = signal<CollectionItem[]>([]);
  readonly chatGroups = signal<CollectionChatGroup[]>([]);
  readonly loading = signal(false);
  readonly chatLoading = signal(false);
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

    try {
      const sessionId = await this.ensureChatSession();
      const response = await firstValueFrom(
        this.collectionsApi.createCollectionChatMessage(sessionId, {
          message: normalized,
        }),
      );
      this.chatGroups.update((groups) => [
        ...groups,
        {
          id: `${response.data.sessionId}-${groups.length + 1}`,
          userText: response.data.userMessage,
          assistantText: response.data.assistantMessage,
          suggestions: this.mapSuggestions(response.data.candidates),
        },
      ]);
    } catch {
      this.chatGroups.update((groups) => [
        ...groups,
        {
          id: `failed-${Date.now()}`,
          userText: normalized,
          assistantText: 'AI 暫時無法回覆，稍後再試一次。',
          suggestions: [],
        },
      ]);
      this.errorMessage.set('AI 回覆失敗，請稍後再試。');
    } finally {
      this.chatLoading.set(false);
    }
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

  private async ensureChatSession(): Promise<string> {
    const existingSessionId = this.chatSessionId();
    if (existingSessionId) return existingSessionId;

    const response = await firstValueFrom(this.collectionsApi.createCollectionChatSession());
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

      for (const [index, relatedCandidate] of (suggestion.relatedCandidates ?? []).entries()) {
        this.pushUniqueSuggestion(visibleSuggestions, seen, {
          id: `${suggestion.id}-related-${index}`,
          kind: relatedCandidate.kind as Exclude<CollectionItemKind, 'sentence'>,
          text: relatedCandidate.text,
          meaning: relatedCandidate.meaning ?? '',
          sourceCardIds: relatedCandidate.sourceCardIds,
          existing: false,
          added: false,
          collectionItemId: null,
          relatedCandidates: [],
        });
      }
    }

    return visibleSuggestions;
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
      sourceWord: suggestion.sourceWord ?? undefined,
      sourceCards: suggestion.sourceCards?.map((card) => ({
        id: card.id,
        word: card.text,
        meaning: card.meaning,
      })),
      sourceCardIds: suggestion.sourceCards?.map((card) => card.id) ?? [],
      existing: suggestion.existing,
      added: suggestion.added,
      collectionItemId: suggestion.collectionItemId ?? null,
      relatedCandidates: suggestion.relatedCandidates?.map((candidate) => ({
        kind: candidate.kind as Exclude<CollectionItemKind, 'sentence'>,
        text: candidate.text,
        meaning: candidate.meaning ?? undefined,
        relationType: candidate.type,
        sourceCardIds: candidate.sourceCardIds,
      })),
    };
  }

  private toCreateRequest(suggestion: CollectionSuggestion): CreateCollectionItemRequest {
    return {
      kind: suggestion.kind,
      text: suggestion.text,
      meaning: suggestion.meaning,
      sourceCardIds:
        suggestion.sourceCards?.map((card) => card.id) ?? suggestion.sourceCardIds ?? [],
      relatedCandidates:
        suggestion.relatedCandidates?.map(
          (candidate): CollectionSaveRelatedCandidate => ({
            kind: candidate.kind,
            text: candidate.text,
            meaning: candidate.meaning,
            type: candidate.relationType,
            sourceCardIds: candidate.sourceCardIds,
          }),
        ) ?? [],
    };
  }
}
