import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCardDto,
  UpdateCardDto,
  ImportCardsDto,
  ImportCardsResult,
  ImportCardError,
} from './dto';
import {
  FsrsService,
  type CardProficiency,
  type CardScheduleState,
} from '../fsrs';

export interface CardListItem {
  id: string;
  cardId: string;
  direction: 'FORWARD' | 'REVERSE';
  front: string;
  summary: string;
  state: string;
  due: string | null;
  proficiency: CardProficiency | null;
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
  note: string | null;
  meanings: CardMeaning[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fsrsService: FsrsService,
  ) {}

  private normalizeNote(
    note: string | null | undefined,
  ): string | null | undefined {
    if (note === undefined) return undefined;
    if (note === null || note.trim() === '') return null;
    return note;
  }

  private async validateDeckAccess(
    deckId: string,
    userId: string,
  ): Promise<{ enableReverse: boolean }> {
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

    return {
      enableReverse: deck.enableReverse,
    };
  }

  async findAllByDeckId(
    deckId: string,
    userId: string,
  ): Promise<CardListItem[]> {
    const deck = await this.validateDeckAccess(deckId, userId);

    const cards = await this.prisma.card.findMany({
      where: { deckId },
      include: { meanings: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    return cards.flatMap((card) => {
      const summary = card.meanings[0]?.zhMeaning ?? '';
      const now = new Date();
      const forwardItem: CardListItem = {
        id: card.id,
        cardId: card.id,
        direction: 'FORWARD',
        front: card.front,
        summary,
        state: card.state,
        due: card.due?.toISOString() ?? null,
        proficiency: this.fsrsService.calculateProficiency(
          {
            state: card.state,
            due: card.due,
            stability: card.stability,
            difficulty: card.difficulty,
            elapsedDays: card.elapsedDays,
            scheduledDays: card.scheduledDays,
            reps: card.reps,
            lapses: card.lapses,
            lastReview: card.lastReview,
            learningStep: card.learningStep,
          } as CardScheduleState,
          now,
        ),
      };

      if (!deck.enableReverse) {
        return [forwardItem];
      }

      return [
        forwardItem,
        {
          id: `${card.id}:REVERSE`,
          cardId: card.id,
          direction: 'REVERSE',
          front: card.front,
          summary,
          state: card.reverseState,
          due: card.reverseDue?.toISOString() ?? null,
          proficiency: this.fsrsService.calculateProficiency(
            {
              state: card.reverseState,
              due: card.reverseDue,
              stability: card.reverseStability,
              difficulty: card.reverseDifficulty,
              elapsedDays: card.reverseElapsedDays,
              scheduledDays: card.reverseScheduledDays,
              reps: card.reverseReps,
              lapses: card.reverseLapses,
              lastReview: card.reverseLastReview,
              learningStep: card.reverseLearningStep,
            } as CardScheduleState,
            now,
          ),
        },
      ];
    });
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
      note: card.note,
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
        note: this.normalizeNote(dto.note) ?? null,
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
        note: card.note,
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
      include: { meanings: { orderBy: { sortOrder: 'asc' } } },
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
        ...(dto.note !== undefined && { note: this.normalizeNote(dto.note) }),
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
        note: card.note,
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

    await this.prisma.card.delete({ where: { id: cardId } });
  }

  async importCards(
    deckId: string,
    userId: string,
    dto: ImportCardsDto,
  ): Promise<ImportCardsResult> {
    await this.validateDeckAccess(deckId, userId);

    const errors: ImportCardError[] = [];

    // 先驗證所有卡片，分出有效與無效
    const validCards: {
      index: number;
      front: string;
      note: string | null;
      meanings: (typeof dto.cards)[number]['meanings'];
    }[] = [];

    for (let i = 0; i < dto.cards.length; i++) {
      const cardData = dto.cards[i];

      if (!cardData.front || cardData.front.trim() === '') {
        errors.push({ index: i, message: 'front 欄位為必填' });
        continue;
      }

      if (
        !cardData.meanings ||
        !Array.isArray(cardData.meanings) ||
        cardData.meanings.length === 0
      ) {
        errors.push({ index: i, message: 'meanings 欄位須為非空陣列' });
        continue;
      }

      const hasValidMeaning = cardData.meanings.some(
        (m) => m.zhMeaning && m.zhMeaning.trim() !== '',
      );
      if (!hasValidMeaning) {
        errors.push({ index: i, message: '至少需要一筆有效的 zhMeaning' });
        continue;
      }

      validCards.push({
        index: i,
        front: cardData.front.trim(),
        note: this.normalizeNote(cardData.note) ?? null,
        meanings: cardData.meanings,
      });
    }

    if (validCards.length === 0) {
      return {
        total: dto.cards.length,
        success: 0,
        failed: dto.cards.length,
        errors,
      };
    }

    // 批次寫入：在同一個 transaction 中建立所有卡片和釋義
    try {
      await this.prisma.$transaction(async (tx) => {
        const createdCards = await tx.card.createManyAndReturn({
          data: validCards.map((c) => ({
            front: c.front,
            note: c.note,
            deckId,
          })),
          select: { id: true },
        });

        const meaningsData = createdCards.flatMap((card, idx) =>
          validCards[idx].meanings
            .filter((m) => m.zhMeaning && m.zhMeaning.trim() !== '')
            .map((m, sortOrder) => ({
              cardId: card.id,
              zhMeaning: m.zhMeaning.trim(),
              enExample: m.enExample?.trim() || null,
              zhExample: m.zhExample?.trim() || null,
              sortOrder,
            })),
        );

        await tx.cardMeaning.createMany({ data: meaningsData });
      });
    } catch {
      return {
        total: dto.cards.length,
        success: 0,
        failed: dto.cards.length,
        errors: [{ index: -1, message: '批次匯入失敗' }],
      };
    }

    const successCount = validCards.length;

    return {
      total: dto.cards.length,
      success: successCount,
      failed: dto.cards.length - successCount,
      errors,
    };
  }
}
