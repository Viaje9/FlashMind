import {
  getEffectiveDailyLimits,
  getStartOfStudyDay,
} from '../modules/study/study-day';
import { ApiError } from './errors';

export type DeckRow = {
  id: string;
  name: string;
  userId: string;
  dailyNewCards: number;
  dailyReviewCards: number;
  dailyResetHour: number;
  enableReverse: boolean;
  overrideDate: string | null;
  overrideNewCards: number | null;
  overrideReviewCards: number | null;
};

export type DeckCounts = {
  totalCount: number;
  newCount: number;
  reviewCount: number;
  reverseNewCount: number;
  reverseReviewCount: number;
  todayNewStudied: number;
  todayReviewStudied: number;
};

export type DeckDetailRow = DeckRow & {
  learningSteps: string;
  relearningSteps: string;
  requestRetention: number;
  maximumInterval: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateDeckInput = {
  name: string;
  dailyNewCards?: number;
  dailyReviewCards?: number;
  dailyResetHour?: number;
  learningSteps?: string;
  relearningSteps?: string;
  requestRetention?: number;
  maximumInterval?: number;
  enableReverse?: boolean;
};

export interface DeckStore {
  listByUser(userId: string): Promise<DeckRow[]>;
  countsForDeck(
    deckId: string,
    studyDayStart: string,
    now: string,
  ): Promise<DeckCounts>;
  findById(id: string): Promise<DeckDetailRow | null>;
  lastStudiedAt(deckId: string): Promise<string | null>;
  insertDeck(deck: DeckDetailRow): Promise<void>;
}

export class DeckService {
  constructor(
    private readonly store: DeckStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(userId: string, timezone: string) {
    const decks = await this.store.listByUser(userId);
    const now = this.now();
    return Promise.all(
      decks.map(async (deck) => {
        const studyDayStart = getStartOfStudyDay(
          now,
          deck.dailyResetHour,
          timezone,
        );
        const counts = await this.store.countsForDeck(
          deck.id,
          studyDayStart.toISOString(),
          now.toISOString(),
        );
        const { effectiveNewCards, effectiveReviewCards } =
          getEffectiveDailyLimits(
            {
              ...deck,
              overrideDate: deck.overrideDate
                ? new Date(deck.overrideDate)
                : null,
            },
            now,
            timezone,
          );
        const completedCount = counts.totalCount - counts.newCount;
        return {
          id: deck.id,
          name: deck.name,
          newCount:
            counts.newCount + (deck.enableReverse ? counts.reverseNewCount : 0),
          reviewCount:
            counts.reviewCount +
            (deck.enableReverse ? counts.reverseReviewCount : 0),
          totalCount: counts.totalCount,
          completedCount,
          progress:
            counts.totalCount > 0
              ? Math.round((completedCount / counts.totalCount) * 100)
              : 0,
          enableReverse: deck.enableReverse,
          dailyNewCards: effectiveNewCards,
          dailyReviewCards: effectiveReviewCards,
          todayNewStudied: counts.todayNewStudied,
          todayReviewStudied: counts.todayReviewStudied,
        };
      }),
    );
  }

  async get(id: string, userId: string) {
    const deck = await this.store.findById(id);
    if (!deck) throw new ApiError('DECK_NOT_FOUND', '找不到此牌組', 404);
    if (deck.userId !== userId) {
      throw new ApiError('FORBIDDEN', '無權限存取此牌組', 403);
    }
    const now = this.now().toISOString();
    const [counts, lastStudiedAt] = await Promise.all([
      this.store.countsForDeck(id, now, now),
      this.store.lastStudiedAt(id),
    ]);
    return {
      id: deck.id,
      name: deck.name,
      dailyNewCards: deck.dailyNewCards,
      dailyReviewCards: deck.dailyReviewCards,
      dailyResetHour: deck.dailyResetHour,
      learningSteps: deck.learningSteps,
      relearningSteps: deck.relearningSteps,
      requestRetention: deck.requestRetention,
      maximumInterval: deck.maximumInterval,
      enableReverse: deck.enableReverse,
      stats: {
        newCount:
          counts.newCount + (deck.enableReverse ? counts.reverseNewCount : 0),
        reviewCount:
          counts.reviewCount +
          (deck.enableReverse ? counts.reverseReviewCount : 0),
        totalCount: counts.totalCount,
        createdAt: new Date(deck.createdAt).toISOString(),
        lastStudiedAt: lastStudiedAt
          ? new Date(lastStudiedAt).toISOString()
          : null,
      },
    };
  }

  async create(userId: string, input: CreateDeckInput) {
    const at = this.now().toISOString();
    const deck: DeckDetailRow = {
      id: crypto.randomUUID(),
      userId,
      name: input.name,
      dailyNewCards: input.dailyNewCards ?? 20,
      dailyReviewCards: input.dailyReviewCards ?? 100,
      dailyResetHour: input.dailyResetHour ?? 4,
      learningSteps: input.learningSteps ?? '1m,10m',
      relearningSteps: input.relearningSteps ?? '10m',
      requestRetention: input.requestRetention ?? 0.9,
      maximumInterval: input.maximumInterval ?? 36500,
      enableReverse: input.enableReverse ?? false,
      overrideDate: null,
      overrideNewCards: null,
      overrideReviewCards: null,
      createdAt: at,
      updatedAt: at,
    };
    await this.store.insertDeck(deck);
    return {
      data: {
        id: deck.id,
        name: deck.name,
        dailyNewCards: deck.dailyNewCards,
        dailyReviewCards: deck.dailyReviewCards,
        dailyResetHour: deck.dailyResetHour,
        learningSteps: deck.learningSteps,
        relearningSteps: deck.relearningSteps,
        requestRetention: deck.requestRetention,
        maximumInterval: deck.maximumInterval,
        enableReverse: deck.enableReverse,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      },
    };
  }
}
