import { computed, inject, Injectable, signal } from '@angular/core';
import { StudyService, StudyCard, StudySummary, SubmitReviewRequest } from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';
import {
  StudyRating,
  StudyStats,
  createInitialStats,
  updateStats,
  isUnknownRating,
} from './study.domain';

export type StudyPhase = 'loading' | 'ready' | 'studying' | 'completed' | 'error';

export interface StudyStoreState {
  deckId: string | null;
  deckName: string;
  cards: StudyCard[];
  currentIndex: number;
  failedQueue: StudyCard[];
  stats: StudyStats;
  summary: StudySummary | null;
  phase: StudyPhase;
  error: string | null;
  isFlipped: boolean;
  history: { card: StudyCard; rating: StudyRating }[];
}

@Injectable({ providedIn: 'root' })
export class StudyStore {
  private readonly studyService = inject(StudyService);

  private readonly state = signal<StudyStoreState>({
    deckId: null,
    deckName: '',
    cards: [],
    currentIndex: 0,
    failedQueue: [],
    stats: createInitialStats(),
    summary: null,
    phase: 'loading',
    error: null,
    isFlipped: false,
    history: [],
  });

  // Selectors
  readonly phase = computed(() => this.state().phase);
  readonly error = computed(() => this.state().error);
  readonly deckName = computed(() => this.state().deckName);
  readonly isFlipped = computed(() => this.state().isFlipped);
  readonly stats = computed(() => this.state().stats);
  readonly summary = computed(() => this.state().summary);

  readonly currentCard = computed(() => {
    const s = this.state();
    if (s.currentIndex < s.cards.length) {
      return s.cards[s.currentIndex];
    }
    if (s.failedQueue.length > 0) {
      return s.failedQueue[0];
    }
    return null;
  });

  readonly progress = computed(() => {
    const s = this.state();
    const total = s.cards.length;
    const current = Math.min(s.currentIndex + 1, total);
    return { current, total };
  });

  readonly canUndo = computed(() => this.state().history.length > 0);

  readonly isStudyingFailedCards = computed(() => {
    const s = this.state();
    return s.currentIndex >= s.cards.length && s.failedQueue.length > 0;
  });

  /**
   * 開始學習
   */
  async startStudy(deckId: string, deckName: string): Promise<void> {
    this.state.update((s) => ({
      ...s,
      deckId,
      deckName,
      phase: 'loading',
      error: null,
      cards: [],
      currentIndex: 0,
      failedQueue: [],
      stats: createInitialStats(),
      isFlipped: false,
      history: [],
    }));

    try {
      const response = await firstValueFrom(this.studyService.getStudyCards(deckId));
      const cards = response.data;

      if (cards.length === 0) {
        this.state.update((s) => ({
          ...s,
          phase: 'completed',
        }));
        return;
      }

      this.state.update((s) => ({
        ...s,
        cards,
        phase: 'studying',
      }));
    } catch (err) {
      this.state.update((s) => ({
        ...s,
        phase: 'error',
        error: '載入學習卡片失敗',
      }));
    }
  }

  /**
   * 翻卡
   */
  flipCard(): void {
    this.state.update((s) => ({ ...s, isFlipped: !s.isFlipped }));
  }

  /**
   * 提交評分
   */
  async submitRating(rating: StudyRating): Promise<void> {
    const s = this.state();
    const card = this.currentCard();
    if (!card || !s.deckId) return;

    // 記錄歷史
    this.state.update((state) => ({
      ...state,
      history: [...state.history, { card, rating }],
    }));

    try {
      // 呼叫 API 更新排程
      await firstValueFrom(
        this.studyService.submitReview(s.deckId, {
          cardId: card.id,
          rating: rating as SubmitReviewRequest.RatingEnum,
        })
      );

      // 如果是「不知道」，加入重試佇列
      if (isUnknownRating(rating)) {
        this.state.update((state) => ({
          ...state,
          failedQueue: [...state.failedQueue, card],
        }));
      }

      // 更新統計
      this.state.update((state) => ({
        ...state,
        stats: updateStats(state.stats, rating),
      }));

      // 移動到下一張
      this.moveToNext();
    } catch (err) {
      // API 失敗時回滾歷史
      this.state.update((state) => ({
        ...state,
        history: state.history.slice(0, -1),
        error: '評分提交失敗',
      }));
    }
  }

  /**
   * 返回上一張（撤銷）
   */
  undoRating(): void {
    const s = this.state();
    if (s.history.length === 0) return;

    const lastEntry = s.history[s.history.length - 1];

    this.state.update((state) => {
      // 回滾統計
      const newStats = { ...state.stats };
      switch (lastEntry.rating) {
        case 'known':
          newStats.knownCount--;
          break;
        case 'unfamiliar':
          newStats.unfamiliarCount--;
          break;
        case 'unknown':
          newStats.unknownCount--;
          break;
      }
      newStats.totalStudied--;

      // 如果是從 failedQueue 撤銷，移除該卡片
      let newFailedQueue = state.failedQueue;
      if (isUnknownRating(lastEntry.rating)) {
        newFailedQueue = state.failedQueue.filter((c) => c.id !== lastEntry.card.id);
      }

      // 判斷是否在 failedQueue 階段
      const wasInFailedPhase = state.currentIndex >= state.cards.length;
      let newIndex = state.currentIndex;

      if (wasInFailedPhase) {
        // 如果正在學習 failedQueue，需要特別處理
        newIndex = state.cards.length - 1;
      } else if (state.currentIndex > 0) {
        newIndex = state.currentIndex - 1;
      }

      return {
        ...state,
        currentIndex: newIndex,
        failedQueue: newFailedQueue,
        stats: newStats,
        history: state.history.slice(0, -1),
        isFlipped: false,
        phase: 'studying',
      };
    });
  }

  /**
   * 載入統計摘要
   */
  async loadSummary(): Promise<void> {
    const deckId = this.state().deckId;
    if (!deckId) return;

    try {
      const response = await firstValueFrom(this.studyService.getStudySummary(deckId));
      this.state.update((s) => ({ ...s, summary: response.data }));
    } catch (err) {
      // 靜默失敗
    }
  }

  /**
   * 重置狀態
   */
  reset(): void {
    this.state.set({
      deckId: null,
      deckName: '',
      cards: [],
      currentIndex: 0,
      failedQueue: [],
      stats: createInitialStats(),
      summary: null,
      phase: 'loading',
      error: null,
      isFlipped: false,
      history: [],
    });
  }

  /**
   * 清除錯誤
   */
  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }

  private moveToNext(): void {
    this.state.update((state) => {
      const isInMainCards = state.currentIndex < state.cards.length;

      if (isInMainCards) {
        // 還在主要卡片列表
        const nextIndex = state.currentIndex + 1;
        if (nextIndex < state.cards.length) {
          return { ...state, currentIndex: nextIndex, isFlipped: false };
        }
        // 主要卡片完成，檢查 failedQueue
        if (state.failedQueue.length > 0) {
          return { ...state, currentIndex: nextIndex, isFlipped: false };
        }
        // 全部完成
        return { ...state, phase: 'completed', isFlipped: false };
      } else {
        // 正在學習 failedQueue
        const newFailedQueue = state.failedQueue.slice(1);
        if (newFailedQueue.length > 0) {
          return { ...state, failedQueue: newFailedQueue, isFlipped: false };
        }
        // 全部完成
        return { ...state, failedQueue: [], phase: 'completed', isFlipped: false };
      }
    });
  }
}
