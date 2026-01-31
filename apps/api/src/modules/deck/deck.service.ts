import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CardState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeckDto, UpdateDeckDto } from './dto';

export interface DeckListItem {
  id: string;
  name: string;
  newCount: number;
  reviewCount: number;
  totalCount: number;
  completedCount: number;
  progress: number;
}

export interface DeckDetail {
  id: string;
  name: string;
  dailyNewCards: number;
  dailyReviewCards: number;
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
        const [totalCount, newCount, reviewCount] = await Promise.all([
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
        ]);

        const completedCount = totalCount - newCount;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
          id: deck.id,
          name: deck.name,
          newCount,
          reviewCount,
          totalCount,
          completedCount,
          progress,
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

    const [totalCount, newCount, reviewCount, lastReviewLog] =
      await Promise.all([
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
        this.prisma.reviewLog.findFirst({
          where: { card: { deckId: id } },
          orderBy: { reviewedAt: 'desc' },
        }),
      ]);

    return {
      id: deck.id,
      name: deck.name,
      dailyNewCards: deck.dailyNewCards,
      dailyReviewCards: deck.dailyReviewCards,
      stats: {
        newCount,
        reviewCount,
        totalCount,
        createdAt: deck.createdAt.toISOString(),
        lastStudiedAt: lastReviewLog?.reviewedAt.toISOString() ?? null,
      },
    };
  }

  async create(userId: string, dto: CreateDeckDto) {
    const deck = await this.prisma.deck.create({
      data: {
        name: dto.name,
        dailyNewCards: dto.dailyNewCards ?? 20,
        dailyReviewCards: dto.dailyReviewCards ?? 100,
        userId,
      },
    });

    return {
      data: {
        id: deck.id,
        name: deck.name,
        dailyNewCards: deck.dailyNewCards,
        dailyReviewCards: deck.dailyReviewCards,
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
      },
    });

    return {
      data: {
        id: updatedDeck.id,
        name: updatedDeck.name,
        dailyNewCards: updatedDeck.dailyNewCards,
        dailyReviewCards: updatedDeck.dailyReviewCards,
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
}
