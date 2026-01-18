import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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

    return decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      newCount: 0,
      reviewCount: 0,
      totalCount: 0,
      completedCount: 0,
      progress: 0,
    }));
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

    return {
      id: deck.id,
      name: deck.name,
      dailyNewCards: deck.dailyNewCards,
      dailyReviewCards: deck.dailyReviewCards,
      stats: {
        newCount: 0,
        reviewCount: 0,
        totalCount: 0,
        createdAt: deck.createdAt.toISOString(),
        lastStudiedAt: null,
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
