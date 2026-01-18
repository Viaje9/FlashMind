import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCardDto, UpdateCardDto } from './dto';

export interface CardListItem {
  id: string;
  front: string;
  summary: string;
}

export interface CardMeaning {
  id: string;
  zhMeaning: string;
  enExample: string | null;
  zhExample: string | null;
}

export interface CardDetail {
  id: string;
  front: string;
  meanings: CardMeaning[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CardService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateDeckAccess(
    deckId: string,
    userId: string,
  ): Promise<void> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
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
  }

  async findAllByDeckId(
    deckId: string,
    userId: string,
  ): Promise<CardListItem[]> {
    await this.validateDeckAccess(deckId, userId);

    const cards = await this.prisma.card.findMany({
      where: { deckId },
      include: { meanings: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    return cards.map((card) => ({
      id: card.id,
      front: card.front,
      summary: card.meanings[0]?.zhMeaning ?? '',
    }));
  }

  async findById(
    cardId: string,
    deckId: string,
    userId: string,
  ): Promise<CardDetail> {
    await this.validateDeckAccess(deckId, userId);

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { meanings: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!card || card.deckId !== deckId) {
      throw new NotFoundException({
        error: {
          code: 'CARD_NOT_FOUND',
          message: '找不到此卡片',
        },
      });
    }

    return {
      id: card.id,
      front: card.front,
      meanings: card.meanings.map((m) => ({
        id: m.id,
        zhMeaning: m.zhMeaning,
        enExample: m.enExample,
        zhExample: m.zhExample,
      })),
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  }

  async create(
    deckId: string,
    userId: string,
    dto: CreateCardDto,
  ): Promise<{ data: CardDetail }> {
    await this.validateDeckAccess(deckId, userId);

    const card = await this.prisma.card.create({
      data: {
        front: dto.front,
        deckId,
        meanings: {
          create: dto.meanings.map((m, index) => ({
            zhMeaning: m.zhMeaning,
            enExample: m.enExample,
            zhExample: m.zhExample,
            sortOrder: index,
          })),
        },
      },
      include: { meanings: { orderBy: { sortOrder: 'asc' } } },
    });

    return {
      data: {
        id: card.id,
        front: card.front,
        meanings: card.meanings.map((m) => ({
          id: m.id,
          zhMeaning: m.zhMeaning,
          enExample: m.enExample,
          zhExample: m.zhExample,
        })),
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
      },
    };
  }

  async update(
    cardId: string,
    deckId: string,
    userId: string,
    dto: UpdateCardDto,
  ): Promise<{ data: CardDetail }> {
    await this.validateDeckAccess(deckId, userId);

    const existingCard = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!existingCard || existingCard.deckId !== deckId) {
      throw new NotFoundException({
        error: {
          code: 'CARD_NOT_FOUND',
          message: '找不到此卡片',
        },
      });
    }

    // 如果有更新 meanings，先刪除舊的再建立新的
    if (dto.meanings) {
      await this.prisma.cardMeaning.deleteMany({
        where: { cardId },
      });
    }

    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        ...(dto.front !== undefined && { front: dto.front }),
        ...(dto.meanings && {
          meanings: {
            create: dto.meanings.map((m, index) => ({
              zhMeaning: m.zhMeaning ?? '',
              enExample: m.enExample,
              zhExample: m.zhExample,
              sortOrder: index,
            })),
          },
        }),
      },
      include: { meanings: { orderBy: { sortOrder: 'asc' } } },
    });

    return {
      data: {
        id: card.id,
        front: card.front,
        meanings: card.meanings.map((m) => ({
          id: m.id,
          zhMeaning: m.zhMeaning,
          enExample: m.enExample,
          zhExample: m.zhExample,
        })),
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
      },
    };
  }

  async delete(cardId: string, deckId: string, userId: string): Promise<void> {
    await this.validateDeckAccess(deckId, userId);

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.deckId !== deckId) {
      throw new NotFoundException({
        error: {
          code: 'CARD_NOT_FOUND',
          message: '找不到此卡片',
        },
      });
    }

    await this.prisma.card.delete({
      where: { id: cardId },
    });
  }
}
