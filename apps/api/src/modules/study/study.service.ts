import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FsrsService, StudyRating, CardScheduleState } from '../fsrs';
import { CardState, StudyRating as PrismaStudyRating } from '@prisma/client';

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
}

export interface StudySummary {
  totalCards: number;
  newCount: number;
  reviewCount: number;
  todayStudied: number;
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
  ): Promise<{ dailyNewCards: number; dailyReviewCards: number }> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      select: { userId: true, dailyNewCards: true, dailyReviewCards: true },
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

    return { dailyNewCards: deck.dailyNewCards, dailyReviewCards: deck.dailyReviewCards };
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

  /**
   * 取得今日學習卡片
   * 排序：待複習卡片優先（按 due 升序），再新卡片（按建立時間）
   */
  async getStudyCards(deckId: string, userId: string): Promise<StudyCard[]> {
    const { dailyNewCards, dailyReviewCards } = await this.validateDeckAccess(deckId, userId);
    const now = new Date();

    // 1. 取得待複習卡片（due <= now，且不是 NEW 狀態）
    const dueCards = await this.prisma.card.findMany({
      where: {
        deckId,
        state: { not: CardState.NEW },
        due: { lte: now },
      },
      include: { meanings: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { due: 'asc' },
      take: dailyReviewCards,
    });

    // 2. 計算還能學習多少新卡
    const remainingNewSlots = dailyNewCards;

    // 3. 取得新卡片
    const newCards = await this.prisma.card.findMany({
      where: {
        deckId,
        state: CardState.NEW,
      },
      include: { meanings: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
      take: remainingNewSlots,
    });

    // 4. 合併結果
    const allCards = [...dueCards, ...newCards];

    return allCards.map((card) => ({
      id: card.id,
      front: card.front,
      meanings: card.meanings.map((m) => ({
        id: m.id,
        zhMeaning: m.zhMeaning,
        enExample: m.enExample,
        zhExample: m.zhExample,
      })),
      state: card.state,
      isNew: card.state === CardState.NEW,
    }));
  }

  /**
   * 提交學習評分
   */
  async submitReview(
    deckId: string,
    cardId: string,
    rating: StudyRating,
    userId: string,
  ): Promise<ReviewResult> {
    await this.validateCardAccess(cardId, deckId, userId);

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

    // 建立目前的排程狀態
    const currentState: CardScheduleState = {
      state: card.state as CardScheduleState['state'],
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      lastReview: card.lastReview,
    };

    // 計算新的排程
    const result = this.fsrsService.calculateNextReview(currentState, rating, now);

    // 更新卡片
    await this.prisma.card.update({
      where: { id: cardId },
      data: {
        state: result.card.state as CardState,
        due: result.card.due,
        stability: result.card.stability,
        difficulty: result.card.difficulty,
        elapsedDays: result.card.elapsedDays,
        scheduledDays: result.card.scheduledDays,
        reps: result.card.reps,
        lapses: result.card.lapses,
        lastReview: result.card.lastReview,
      },
    });

    // 建立 ReviewLog
    await this.prisma.reviewLog.create({
      data: {
        cardId,
        rating: this.mapRatingToPrisma(rating),
        reviewedAt: now,
        prevState: card.state,
        prevStability: card.stability,
        prevDifficulty: card.difficulty,
        newState: result.card.state as CardState,
        newStability: result.card.stability,
        newDifficulty: result.card.difficulty,
        scheduledDays: result.card.scheduledDays,
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
  async getSummary(deckId: string, userId: string): Promise<StudySummary> {
    await this.validateDeckAccess(deckId, userId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 總卡片數
    const totalCards = await this.prisma.card.count({
      where: { deckId },
    });

    // 新卡數
    const newCount = await this.prisma.card.count({
      where: { deckId, state: CardState.NEW },
    });

    // 待複習數
    const reviewCount = await this.prisma.card.count({
      where: {
        deckId,
        state: { not: CardState.NEW },
        due: { lte: now },
      },
    });

    // 今日已學習數
    const todayStudied = await this.prisma.reviewLog.count({
      where: {
        card: { deckId },
        reviewedAt: { gte: startOfToday },
      },
    });

    return {
      totalCards,
      newCount,
      reviewCount,
      todayStudied,
    };
  }
}
