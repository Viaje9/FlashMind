import { computed, inject, Injectable, signal } from '@angular/core';
import {
  CardsService,
  CardListItem,
  Card,
  CreateCardRequest,
  UpdateCardRequest,
} from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';

export interface CardStoreState {
  cards: CardListItem[];
  currentCard: Card | null;
  loading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CardStore {
  private readonly cardsService = inject(CardsService);

  private readonly state = signal<CardStoreState>({
    cards: [],
    currentCard: null,
    loading: false,
    error: null,
  });

  readonly cards = computed(() => this.state().cards);
  readonly currentCard = computed(() => this.state().currentCard);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly isEmpty = computed(() => this.state().cards.length === 0 && !this.state().loading);

  async loadCards(deckId: string): Promise<void> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    try {
      const response = await firstValueFrom(this.cardsService.listCards(deckId));
      this.state.update((s) => ({
        ...s,
        cards: response.data,
        loading: false,
      }));
    } catch {
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: '載入卡片失敗',
      }));
    }
  }

  async loadCard(deckId: string, cardId: string): Promise<void> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    try {
      const response = await firstValueFrom(this.cardsService.getCard(deckId, cardId));
      this.state.update((s) => ({
        ...s,
        currentCard: response.data,
        loading: false,
      }));
    } catch {
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: '載入卡片失敗',
      }));
    }
  }

  async createCard(deckId: string, data: CreateCardRequest): Promise<string | null> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    try {
      const response = await firstValueFrom(this.cardsService.createCard(deckId, data));
      this.state.update((s) => ({ ...s, loading: false }));
      return response.data.id;
    } catch {
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: '建立卡片失敗',
      }));
      return null;
    }
  }

  async updateCard(deckId: string, cardId: string, data: UpdateCardRequest): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    try {
      await firstValueFrom(this.cardsService.updateCard(deckId, cardId, data));
      this.state.update((s) => ({ ...s, loading: false }));
      return true;
    } catch {
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: '更新卡片失敗',
      }));
      return false;
    }
  }

  async deleteCard(deckId: string, cardId: string): Promise<boolean> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    try {
      await firstValueFrom(this.cardsService.deleteCard(deckId, cardId));
      this.state.update((s) => ({
        ...s,
        cards: s.cards.filter((c) => c.id !== cardId),
        loading: false,
      }));
      return true;
    } catch {
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: '刪除卡片失敗',
      }));
      return false;
    }
  }

  clearCurrentCard(): void {
    this.state.update((s) => ({ ...s, currentCard: null }));
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }
}
