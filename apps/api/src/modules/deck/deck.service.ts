import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CardState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeckDto, UpdateDeckDto, SetDailyOverrideDto } from './dto';
import { getStartOfStudyDay, getEffectiveDailyLimits } from '../study/study-day';

export interface DeckListItem {
  id: string;
  name: string;
  newCount: number;
  reviewCount: number;
  totalCount: number;
  completedCount: number;
  progress: number;
  enableReverse: boolean;
  dailyNewCards: number;
  dailyReviewCards: number;
  todayNewStudied: number;
  todayReviewStudied: number;
}

export interface DeckDetail {
  id: string;
  name: string;
  dailyNewCards: number;
  dailyReviewCards: number;
  dailyResetHour: number;
  learningSteps: string;
  relearningSteps: string;
  requestRetention: number;
  maximumInterval: number;
  enableReverse: boolean;
  stats: {
    newCount: number;
    reviewCount: number;
    totalCount: number;
    createdAt: string;
    lastStudiedAt: string | null;
  };
}

@Injectable()
export class DeckService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUserId(userId: string): Promise<DeckListItem[]> {
    const decks = await this.prisma.deck.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    const now = new Date();

    return Promise.all(
      decks.map(async (deck) => {
        const startOfStudyDay = getStartOfStudyDay(now, deck.dailyResetHour);

        const queries: Promise<number>[] = [
          this.prisma.card.count({ where: { deckId: deck.id } }),
          this.prisma.card.count({
            where: { deckId: deck.id, state: CardState.NEW },
          }),
          this.prisma.card.count({
            where: {
              deckId: deck.id,
              state: { not: CardState.NEW },
              due: { lte: now },
            },
          }),
        ];

        if (deck.enableReverse) {
          queries.push(
            this.prisma.card.count({
              where: { deckId: deck.id, reverseState: CardState.NEW },
            }),
            this.prisma.card.count({
              where: {
                deckId: deck.id,
                reverseState: { not: CardState.NEW },
                reverseDue: { lte: now },
              },
            }),
          );
        }

        const [counts, todayNewStudied, todayReviewStudied] = await Promise.all([
          Promise.all(queries),
          this.prisma.reviewLog.count({
            where: {
              card: { deckId: deck.id },
              prevState: CardState.NEW,
              reviewedAt: { gte: startOfStudyDay },
            },
          }),
          this.prisma.reviewLog.count({
            where: {
              card: { deckId: deck.id },
              prevState: { not: CardState.NEW },
              reviewedAt: { gte: startOfStudyDay },
            },
          }),
        ]);

        const [totalCount, newCount, reviewCount] = counts;
        const reverseNewCount = deck.enableReverse ? counts[3] : 0;
        const reverseReviewCount = deck.enableReverse ? counts[4] : 0;

        const completedCount = totalCount - newCount;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        const { effectiveNewCards, effectiveReviewCards } = getEffectiveDailyLimits(deck, now);

        return {
          id: deck.id,
          name: deck.name,
          newCount: newCount + reverseNewCount,
          reviewCount: reviewCount + reverseReviewCount,
          totalCount,
          completedCount,
          progress,
          enableReverse: deck.enableReverse,
          dailyNewCards: effectiveNewCards,
          dailyReviewCards: effectiveReviewCards,
          todayNewStudied,
          todayReviewStudied,
        };
      }),
    );
  }

  async findById(id: string, userId: string): Promise<DeckDetail> {
    const deck = await this.prisma.deck.findUnique({
      where: { id },
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

    const now = new Date();

    const baseQueries = [
      this.prisma.card.count({ where: { deckId: id } }),
      this.prisma.card.count({
        where: { deckId: id, state: CardState.NEW },
      }),
      this.prisma.card.count({
        where: {
          deckId: id,
          state: { not: CardState.NEW },
          due: { lte: now },
        },
      }),
    ] as const;

    const reverseQueries = deck.enableReverse
      ? ([
          this.prisma.card.count({
            where: { deckId: id, reverseState: CardState.NEW },
          }),
          this.prisma.card.count({
            where: {
              deckId: id,
              reverseState: { not: CardState.NEW },
              reverseDue: { lte: now },
            },
          }),
        ] as const)
      : ([] as const);

    const [totalCount, newCount, reviewCount, ...reverseCounts] =
      await Promise.all([
        ...baseQueries,
        ...reverseQueries,
        this.prisma.reviewLog.findFirst({
          where: { card: { deckId: id } },
          orderBy: { reviewedAt: 'desc' },
        }),
      ]);

    const reverseNewCount = deck.enableReverse ? (reverseCounts[0] as number) : 0;
    const reverseReviewCount = deck.enableReverse ? (reverseCounts[1] as number) : 0;
    const lastReviewLog = deck.enableReverse ? reverseCounts[2] : reverseCounts[0];

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
        newCount: (newCount as number) + reverseNewCount,
        reviewCount: (reviewCount as number) + reverseReviewCount,
        totalCount: totalCount as number,
        createdAt: deck.createdAt.toISOString(),
        lastStudiedAt: (lastReviewLog as { reviewedAt: Date } | null)?.reviewedAt.toISOString() ?? null,
      },
    };
  }

  async create(userId: string, dto: CreateDeckDto) {
    const deck = await this.prisma.deck.create({
      data: {
        name: dto.name,
        dailyNewCards: dto.dailyNewCards ?? 20,
        dailyReviewCards: dto.dailyReviewCards ?? 100,
        dailyResetHour: dto.dailyResetHour ?? 4,
        learningSteps: dto.learningSteps ?? '1m,10m',
        relearningSteps: dto.relearningSteps ?? '10m',
        requestRetention: dto.requestRetention ?? 0.9,
        maximumInterval: dto.maximumInterval ?? 36500,
        enableReverse: dto.enableReverse ?? false,
        userId,
      },
    });

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
        createdAt: deck.createdAt.toISOString(),
        updatedAt: deck.updatedAt.toISOString(),
      },
    };
  }

  async update(id: string, userId: string, dto: UpdateDeckDto) {
    const deck = await this.prisma.deck.findUnique({
      where: { id },
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
          message: '無權限修改此牌組',
        },
      });
    }

    const updatedDeck = await this.prisma.deck.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.dailyNewCards !== undefined && {
          dailyNewCards: dto.dailyNewCards,
        }),
        ...(dto.dailyReviewCards !== undefined && {
          dailyReviewCards: dto.dailyReviewCards,
        }),
        ...(dto.dailyResetHour !== undefined && {
          dailyResetHour: dto.dailyResetHour,
        }),
        ...(dto.learningSteps !== undefined && {
          learningSteps: dto.learningSteps,
        }),
        ...(dto.relearningSteps !== undefined && {
          relearningSteps: dto.relearningSteps,
        }),
        ...(dto.requestRetention !== undefined && {
          requestRetention: dto.requestRetention,
        }),
        ...(dto.maximumInterval !== undefined && {
          maximumInterval: dto.maximumInterval,
        }),
        ...(dto.enableReverse !== undefined && {
          enableReverse: dto.enableReverse,
        }),
      },
    });

    return {
      data: {
        id: updatedDeck.id,
        name: updatedDeck.name,
        dailyNewCards: updatedDeck.dailyNewCards,
        dailyReviewCards: updatedDeck.dailyReviewCards,
        dailyResetHour: updatedDeck.dailyResetHour,
        learningSteps: updatedDeck.learningSteps,
        relearningSteps: updatedDeck.relearningSteps,
        requestRetention: updatedDeck.requestRetention,
        maximumInterval: updatedDeck.maximumInterval,
        enableReverse: updatedDeck.enableReverse,
        createdAt: updatedDeck.createdAt.toISOString(),
        updatedAt: updatedDeck.updatedAt.toISOString(),
      },
    };
  }

  async delete(id: string, userId: string): Promise<void> {
    const deck = await this.prisma.deck.findUnique({
      where: { id },
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
          message: '無權限刪除此牌組',
        },
      });
    }

    await this.prisma.deck.delete({
      where: { id },
    });
  }

  async setDailyOverride(id: string, userId: string, dto: SetDailyOverrideDto) {
    const deck = await this.prisma.deck.findUnique({
      where: { id },
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

    if (dto.newCards !== undefined && dto.newCards < deck.dailyNewCards) {
      throw new UnprocessableEntityException({
        error: {
          code: 'OVERRIDE_BELOW_DEFAULT',
          message: `覆寫值必須大於或等於預設值（每日新卡上限：${deck.dailyNewCards}）`,
        },
      });
    }

    if (dto.reviewCards !== undefined && dto.reviewCards < deck.dailyReviewCards) {
      throw new UnprocessableEntityException({
        error: {
          code: 'OVERRIDE_BELOW_DEFAULT',
          message: `覆寫值必須大於或等於預設值（每日複習上限：${deck.dailyReviewCards}）`,
        },
      });
    }

    const now = new Date();
    const overrideDate = getStartOfStudyDay(now, deck.dailyResetHour);

    const updatedDeck = await this.prisma.deck.update({
      where: { id },
      data: {
        overrideDate,
        overrideNewCards: dto.newCards ?? null,
        overrideReviewCards: dto.reviewCards ?? null,
      },
    });

    const { effectiveNewCards, effectiveReviewCards } = getEffectiveDailyLimits(updatedDeck, now);

    return {
      data: {
        effectiveNewCards,
        effectiveReviewCards,
      },
    };
  }
}
