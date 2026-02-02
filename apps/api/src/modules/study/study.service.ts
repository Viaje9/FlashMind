import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FsrsService,
  StudyRating,
  CardScheduleState,
  DeckFsrsParams,
} from '../fsrs';
import { CardState, StudyRating as PrismaStudyRating } from '@prisma/client';
import { getStartOfStudyDay, getEffectiveDailyLimits } from './study-day';
import {
  shuffleWithSpacing,
  MIN_FORWARD_REVERSE_SPACING,
} from './shuffle-with-spacing';

export interface StudyCardMeaning {
  id: string;
  zhMeaning: string;
  enExample: string | null;
  zhExample: string | null;
}

export interface StudyCard {
  id: string;
  front: string;
  meanings: StudyCardMeaning[];
  state: CardState;
  isNew: boolean;
  direction: 'FORWARD' | 'REVERSE';
}

export interface StudySummary {
  totalCards: number;
  newCount: number;
  reviewCount: number;
  todayStudied: number;
  dailyNewCards: number;
  dailyReviewCards: number;
  todayNewStudied: number;
  todayReviewStudied: number;
}

export interface ReviewResult {
  cardId: string;
  rating: StudyRating;
  nextDue: string;
  newState: CardState;
}

@Injectable()
export class StudyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fsrsService: FsrsService,
  ) {}

  private async validateDeckAccess(
    deckId: string,
    userId: string,
  ): Promise<{
    dailyNewCards: number;
    dailyReviewCards: number;
    dailyResetHour: number;
    requestRetention: number;
    maximumInterval: number;
    learningSteps: string;
    relearningSteps: string;
    enableReverse: boolean;
    overrideDate: Date | null;
    overrideNewCards: number | null;
    overrideReviewCards: number | null;
  }> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      select: {
        userId: true,
        dailyNewCards: true,
        dailyReviewCards: true,
        dailyResetHour: true,
        requestRetention: true,
        maximumInterval: true,
        learningSteps: true,
        relearningSteps: true,
        enableReverse: true,
        overrideDate: true,
        overrideNewCards: true,
        overrideReviewCards: true,
      },
    });

    if (!deck) {
      throw new NotFoundException({
        error: {
          code: 'DECK_NOT_FOUND',
          message: '找不到此牌組',
        },
      });
    }

    if (deck.userId !== userId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: '無權限存取此牌組',
        },
      });
    }

    return {
      dailyNewCards: deck.dailyNewCards,
      dailyReviewCards: deck.dailyReviewCards,
      dailyResetHour: deck.dailyResetHour,
      requestRetention: deck.requestRetention,
      maximumInterval: deck.maximumInterval,
      learningSteps: deck.learningSteps,
      relearningSteps: deck.relearningSteps,
      enableReverse: deck.enableReverse,
      overrideDate: deck.overrideDate,
      overrideNewCards: deck.overrideNewCards,
      overrideReviewCards: deck.overrideReviewCards,
    };
  }

  private async validateCardAccess(
    cardId: string,
    deckId: string,
    userId: string,
  ): Promise<void> {
    await this.validateDeckAccess(deckId, userId);

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { deckId: true },
    });

    if (!card || card.deckId !== deckId) {
      throw new NotFoundException({
        error: {
          code: 'CARD_NOT_FOUND',
          message: '找不到此卡片',
        },
      });
    }
  }

  private mapToStudyCard(
    card: {
      id: string;
      front: string;
      state: CardState;
      reverseState: CardState;
      meanings: {
        id: string;
        zhMeaning: string;
        enExample: string | null;
        zhExample: string | null;
      }[];
    },
    direction: 'FORWARD' | 'REVERSE',
  ): StudyCard {
    const state = direction === 'FORWARD' ? card.state : card.reverseState;
    return {
      id: card.id,
      front: card.front,
      meanings: card.meanings.map((m) => ({
        id: m.id,
        zhMeaning: m.zhMeaning,
        enExample: m.enExample,
        zhExample: m.zhExample,
      })),
      state,
      isNew: state === CardState.NEW,
      direction,
    };
  }

  /**
   * 取得今日學習卡片
   * 排序：新卡與複習卡隨機混合，同一張卡的正反向至少間隔 5 張
   */
  async getStudyCards(
    deckId: string,
    userId: string,
    timezone: string,
  ): Promise<StudyCard[]> {
    const deckSettings = await this.validateDeckAccess(deckId, userId);
    const { dailyResetHour, enableReverse } = deckSettings;
    const now = new Date();
    const startOfStudyDay = getStartOfStudyDay(now, dailyResetHour, timezone);
    const { effectiveNewCards, effectiveReviewCards } = getEffectiveDailyLimits(
      deckSettings,
      now,
      timezone,
    );

    // 查今日已學新卡數
    const todayNewCardsStudied = await this.prisma.reviewLog.count({
      where: {
        card: { deckId },
        prevState: CardState.NEW,
        reviewedAt: { gte: startOfStudyDay },
      },
    });

    // 查今日已複習數（非新卡）
    const todayReviewCardsStudied = await this.prisma.reviewLog.count({
      where: {
        card: { deckId },
        prevState: { not: CardState.NEW },
        reviewedAt: { gte: startOfStudyDay },
      },
    });

    const remainingReviewSlots = Math.max(
      0,
      effectiveReviewCards - todayReviewCardsStudied,
    );
    const remainingNewSlots = Math.max(
      0,
      effectiveNewCards - todayNewCardsStudied,
    );

    // 1. 取得正向待複習卡片（due <= now，且不是 NEW 狀態）
    const forwardDueCards =
      remainingReviewSlots > 0
        ? await this.prisma.card.findMany({
            where: {
              deckId,
              state: { not: CardState.NEW },
              due: { lte: now },
            },
            include: { meanings: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { due: 'asc' },
            take: remainingReviewSlots,
          })
        : [];

    // 2. 取得正向新卡片
    const forwardNewCards =
      remainingNewSlots > 0
        ? await this.prisma.card.findMany({
            where: {
              deckId,
              state: CardState.NEW,
            },
            include: { meanings: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { createdAt: 'asc' },
            take: remainingNewSlots,
          })
        : [];

    // 正向結果
    const forwardDueStudyCards = forwardDueCards.map((card) =>
      this.mapToStudyCard(card, 'FORWARD'),
    );
    const forwardNewStudyCards = forwardNewCards.map((card) =>
      this.mapToStudyCard(card, 'FORWARD'),
    );

    // 3. 若 enableReverse，取得反向卡片
    let reverseDueStudyCards: StudyCard[] = [];
    let reverseNewStudyCards: StudyCard[] = [];

    if (enableReverse) {
      const reverseRemainingReviewSlots = Math.max(
        0,
        remainingReviewSlots - forwardDueCards.length,
      );
      const reverseRemainingNewSlots = Math.max(
        0,
        remainingNewSlots - forwardNewCards.length,
      );

      const reverseDueCards =
        reverseRemainingReviewSlots > 0
          ? await this.prisma.card.findMany({
              where: {
                deckId,
                reverseState: { not: CardState.NEW },
                reverseDue: { lte: now },
              },
              include: { meanings: { orderBy: { sortOrder: 'asc' } } },
              orderBy: { reverseDue: 'asc' },
              take: reverseRemainingReviewSlots,
            })
          : [];

      const reverseNewCards =
        reverseRemainingNewSlots > 0
          ? await this.prisma.card.findMany({
              where: {
                deckId,
                reverseState: CardState.NEW,
              },
              include: { meanings: { orderBy: { sortOrder: 'asc' } } },
              orderBy: { createdAt: 'asc' },
              take: reverseRemainingNewSlots,
            })
          : [];

      reverseDueStudyCards = reverseDueCards.map((card) =>
        this.mapToStudyCard(card, 'REVERSE'),
      );
      reverseNewStudyCards = reverseNewCards.map((card) =>
        this.mapToStudyCard(card, 'REVERSE'),
      );
    }

    // 4. 合併並隨機混合排列，正反向至少間隔 MIN_FORWARD_REVERSE_SPACING 張
    const allCards = [
      ...forwardDueStudyCards,
      ...reverseDueStudyCards,
      ...forwardNewStudyCards,
      ...reverseNewStudyCards,
    ];

    return shuffleWithSpacing(allCards, MIN_FORWARD_REVERSE_SPACING);
  }

  /**
   * 提交學習評分
   */
  async submitReview(
    deckId: string,
    cardId: string,
    rating: StudyRating,
    userId: string,
    direction: 'FORWARD' | 'REVERSE' = 'FORWARD',
  ): Promise<ReviewResult> {
    const deckSettings = await this.validateDeckAccess(deckId, userId);

    const cardBelongsToDeck = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { deckId: true },
    });

    if (!cardBelongsToDeck || cardBelongsToDeck.deckId !== deckId) {
      throw new NotFoundException({
        error: {
          code: 'CARD_NOT_FOUND',
          message: '找不到此卡片',
        },
      });
    }

    const now = new Date();

    // 取得卡片目前狀態
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException({
        error: {
          code: 'CARD_NOT_FOUND',
          message: '找不到此卡片',
        },
      });
    }

    // 根據 direction 讀取對應 FSRS 欄位
    const currentState: CardScheduleState =
      direction === 'FORWARD'
        ? {
            state: card.state as CardScheduleState['state'],
            due: card.due,
            stability: card.stability,
            difficulty: card.difficulty,
            elapsedDays: card.elapsedDays,
            scheduledDays: card.scheduledDays,
            reps: card.reps,
            lapses: card.lapses,
            lastReview: card.lastReview,
            learningStep: card.learningStep,
          }
        : {
            state: card.reverseState as CardScheduleState['state'],
            due: card.reverseDue,
            stability: card.reverseStability,
            difficulty: card.reverseDifficulty,
            elapsedDays: card.reverseElapsedDays,
            scheduledDays: card.reverseScheduledDays,
            reps: card.reverseReps,
            lapses: card.reverseLapses,
            lastReview: card.reverseLastReview,
            learningStep: card.reverseLearningStep,
          };

    // 計算新的排程（使用牌組專屬 FSRS 參數）
    const fsrsParams: DeckFsrsParams = {
      requestRetention: deckSettings.requestRetention,
      maximumInterval: deckSettings.maximumInterval,
      learningSteps: this.fsrsService.parseLearningSteps(
        deckSettings.learningSteps,
      ),
      relearningSteps: this.fsrsService.parseLearningSteps(
        deckSettings.relearningSteps,
      ),
    };
    const result = this.fsrsService.calculateNextReview(
      currentState,
      rating,
      now,
      fsrsParams,
    );

    // 根據 direction 更新對應欄位
    const updateData =
      direction === 'FORWARD'
        ? {
            state: result.card.state as CardState,
            due: result.card.due,
            stability: result.card.stability,
            difficulty: result.card.difficulty,
            elapsedDays: result.card.elapsedDays,
            scheduledDays: result.card.scheduledDays,
            reps: result.card.reps,
            lapses: result.card.lapses,
            lastReview: result.card.lastReview,
            learningStep: result.card.learningStep,
          }
        : {
            reverseState: result.card.state as CardState,
            reverseDue: result.card.due,
            reverseStability: result.card.stability,
            reverseDifficulty: result.card.difficulty,
            reverseElapsedDays: result.card.elapsedDays,
            reverseScheduledDays: result.card.scheduledDays,
            reverseReps: result.card.reps,
            reverseLapses: result.card.lapses,
            reverseLastReview: result.card.lastReview,
            reverseLearningStep: result.card.learningStep,
          };

    // 更新卡片
    await this.prisma.card.update({
      where: { id: cardId },
      data: updateData,
    });

    // 根據 direction 讀取 prev 欄位
    const prevState = direction === 'FORWARD' ? card.state : card.reverseState;
    const prevStability =
      direction === 'FORWARD' ? card.stability : card.reverseStability;
    const prevDifficulty =
      direction === 'FORWARD' ? card.difficulty : card.reverseDifficulty;

    // 建立 ReviewLog
    await this.prisma.reviewLog.create({
      data: {
        cardId,
        rating: this.mapRatingToPrisma(rating),
        reviewedAt: now,
        prevState,
        prevStability,
        prevDifficulty,
        newState: result.card.state as CardState,
        newStability: result.card.stability,
        newDifficulty: result.card.difficulty,
        scheduledDays: result.card.scheduledDays,
        direction,
      },
    });

    return {
      cardId,
      rating,
      nextDue: result.card.due?.toISOString() ?? now.toISOString(),
      newState: result.card.state as CardState,
    };
  }

  private mapRatingToPrisma(rating: StudyRating): PrismaStudyRating {
    switch (rating) {
      case 'known':
        return PrismaStudyRating.KNOWN;
      case 'unfamiliar':
        return PrismaStudyRating.UNFAMILIAR;
      case 'unknown':
        return PrismaStudyRating.UNKNOWN;
    }
  }

  /**
   * 取得學習統計摘要
   */
  async getSummary(
    deckId: string,
    userId: string,
    timezone: string,
  ): Promise<StudySummary> {
    const deckSettings = await this.validateDeckAccess(deckId, userId);
    const { dailyResetHour, enableReverse } = deckSettings;
    const now = new Date();
    const startOfToday = getStartOfStudyDay(now, dailyResetHour, timezone);
    const { effectiveNewCards, effectiveReviewCards } = getEffectiveDailyLimits(
      deckSettings,
      now,
      timezone,
    );

    // 總卡片數
    const totalCards = await this.prisma.card.count({
      where: { deckId },
    });

    // 正向新卡數
    const forwardNewCount = await this.prisma.card.count({
      where: { deckId, state: CardState.NEW },
    });

    // 正向待複習數
    const forwardReviewCount = await this.prisma.card.count({
      where: {
        deckId,
        state: { not: CardState.NEW },
        due: { lte: now },
      },
    });

    let newCount = forwardNewCount;
    let reviewCount = forwardReviewCount;

    // 若 enableReverse，加計反向統計
    if (enableReverse) {
      const reverseNewCount = await this.prisma.card.count({
        where: { deckId, reverseState: CardState.NEW },
      });

      const reverseReviewCount = await this.prisma.card.count({
        where: {
          deckId,
          reverseState: { not: CardState.NEW },
          reverseDue: { lte: now },
        },
      });

      newCount += reverseNewCount;
      reviewCount += reverseReviewCount;
    }

    // 今日已學習數
    const todayStudied = await this.prisma.reviewLog.count({
      where: {
        card: { deckId },
        reviewedAt: { gte: startOfToday },
      },
    });

    // 今日已學新卡數（prevState = NEW）
    const todayNewStudied = await this.prisma.reviewLog.count({
      where: {
        card: { deckId },
        prevState: CardState.NEW,
        reviewedAt: { gte: startOfToday },
      },
    });

    // 今日已複習數（prevState != NEW）
    const todayReviewStudied = await this.prisma.reviewLog.count({
      where: {
        card: { deckId },
        prevState: { not: CardState.NEW },
        reviewedAt: { gte: startOfToday },
      },
    });

    return {
      totalCards,
      newCount,
      reviewCount,
      todayStudied,
      dailyNewCards: effectiveNewCards,
      dailyReviewCards: effectiveReviewCards,
      todayNewStudied,
      todayReviewStudied,
    };
  }
}
