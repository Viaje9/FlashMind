import { Injectable, computed, signal } from '@angular/core';
import {
  INITIAL_CHAT_GROUPS,
  MOCK_COLLECTION_ITEMS,
  type CollectionChatGroup,
  type CollectionItem,
  type CollectionSuggestion,
  createCollectionItemFromSuggestion,
  createDelayMeetingChatGroup,
} from './collection-pack.domain';

@Injectable({ providedIn: 'root' })
export class CollectionPackStore {
  readonly items = signal<CollectionItem[]>([...MOCK_COLLECTION_ITEMS]);
  readonly chatGroups = signal<CollectionChatGroup[]>(cloneChatGroups(INITIAL_CHAT_GROUPS));
  readonly collectionCount = computed(() => this.items().length);
  readonly vocabularyCoverage = signal(72);

  addSuggestion(groupId: string, suggestionId: string): void {
    const suggestion = this.findSuggestion(groupId, suggestionId);
    if (!suggestion || suggestion.existing || suggestion.added) return;

    this.items.update((items) => [...items, createCollectionItemFromSuggestion(suggestion)]);
    this.patchSuggestion(groupId, suggestionId, { added: true });
  }

  removeSuggestion(groupId: string, suggestionId: string): void {
    const suggestion = this.findSuggestion(groupId, suggestionId);
    if (!suggestion || suggestion.existing || !suggestion.added) return;

    this.items.update((items) => items.filter((item) => item.id !== `added-${suggestion.id}`));
    this.patchSuggestion(groupId, suggestionId, { added: false });
  }

  appendMockChat(userText: string): void {
    const normalized = userText.trim();
    if (!normalized) return;

    this.chatGroups.update((groups) => [
      ...groups,
      createDelayMeetingChatGroup(groups.length + 1, normalized),
    ]);
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
}

function cloneChatGroups(groups: CollectionChatGroup[]): CollectionChatGroup[] {
  return groups.map((group) => ({
    ...group,
    suggestions: group.suggestions.map((suggestion) => ({ ...suggestion })),
  }));
}
