import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, TargetVocabularyStatus } from '@prisma/client';
import {
  nextVocabularyStatus,
  type SpeakingRecordedResult,
} from '@flashmind/shared';

import { PrismaService } from '../../prisma/prisma.service';
import {
  AddTargetVocabularyToDeckDto,
  ImportTargetVocabularyDto,
  ListTargetVocabularyDto,
  TargetVocabularyStatusDto,
} from './dto';

export interface TargetVocabularyReviewUse {
  term: string;
  expressionContext: string;
  naturalSentence: string;
}

export interface TargetVocabularyReviewRecommendation extends TargetVocabularyReviewUse {
  recommendationReason: string;
}

export interface TargetVocabularyReviewUpdate {
  actualUses: TargetVocabularyReviewUse[];
  recommendations: TargetVocabularyReviewRecommendation[];
}

@Injectable()
export class TargetVocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async listWords(userId: string, query: ListTargetVocabularyDto) {
    const search = query.q?.trim();
    const where: Prisma.TargetVocabularyWhereInput = {
      userId,
      ...(query.status ? { status: this.toStatus(query.status) } : {}),
      ...(search
        ? {
            OR: [
              { term: { contains: search, mode: 'insensitive' } },
              { zhMeaning: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const words = await this.prisma.targetVocabulary.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return { data: words };
  }

  async importWords(userId: string, dto: ImportTargetVocabularyDto) {
    const candidates = dto.words.map((word) => ({
      term: word.term.trim(),
      normalizedTerm: this.normalizeTerm(word.term),
      zhMeaning: word.zhMeaning.trim(),
    }));

    const normalizedTerms = [
      ...new Set(candidates.map((word) => word.normalizedTerm)),
    ];
    const [existingTargets, existingCards] = await Promise.all([
      this.prisma.targetVocabulary.findMany({
        where: { userId, normalizedTerm: { in: normalizedTerms } },
        select: { normalizedTerm: true },
      }),
      this.prisma.card.findMany({
        where: { deck: { userId } },
        select: { front: true },
      }),
    ]);

    const targetTerms = new Set(
      existingTargets.map((item) => item.normalizedTerm),
    );
    const cardTerms = new Set(
      existingCards.map((card) => this.normalizeTerm(card.front)),
    );
    const seenInRequest = new Set<string>();
    const newWords: typeof candidates = [];
    let alreadyInTargets = 0;
    let alreadyInCards = 0;

    for (const candidate of candidates) {
      if (cardTerms.has(candidate.normalizedTerm)) {
        alreadyInCards += 1;
      } else if (
        targetTerms.has(candidate.normalizedTerm) ||
        seenInRequest.has(candidate.normalizedTerm)
      ) {
        alreadyInTargets += 1;
      } else {
        seenInRequest.add(candidate.normalizedTerm);
        newWords.push(candidate);
      }
    }

    const created = await this.prisma.targetVocabulary.createMany({
      data: newWords.map((word) => ({
        userId,
        ...word,
        status: TargetVocabularyStatus.UNSEEN,
      })),
      skipDuplicates: true,
    });

    return {
      data: {
        total: dto.words.length,
        added: created.count,
        alreadyInTargets,
        alreadyInCards,
      },
    };
  }

  async listReviewCandidates(userId: string) {
    return this.prisma.targetVocabulary.findMany({
      where: { userId },
      select: {
        id: true,
        term: true,
        normalizedTerm: true,
        zhMeaning: true,
        status: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async applyReview(
    userId: string,
    review: TargetVocabularyReviewUpdate,
  ): Promise<void> {
    const recommendations = this.uniqueReviewItems(review.recommendations);
    const actualUses = this.uniqueReviewItems(review.actualUses);
    const operations: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];

    for (const recommendation of recommendations) {
      const normalizedTerm = this.normalizeTerm(recommendation.term);
      operations.push(
        this.prisma.targetVocabulary.updateMany({
          where: { userId, normalizedTerm },
          data: {
            recommendationCount: { increment: 1 },
            expressionContext: recommendation.expressionContext,
            naturalSentence: recommendation.naturalSentence,
            recommendationReason: recommendation.recommendationReason,
          },
        }),
        this.prisma.targetVocabulary.updateMany({
          where: {
            userId,
            normalizedTerm,
            status: TargetVocabularyStatus.UNSEEN,
          },
          data: { status: TargetVocabularyStatus.PRACTICING },
        }),
      );
    }

    for (const actualUse of actualUses) {
      const normalizedTerm = this.normalizeTerm(actualUse.term);
      operations.push(
        this.prisma.targetVocabulary.updateMany({
          where: { userId, normalizedTerm },
          data: {
            useCount: { increment: 1 },
            expressionContext: actualUse.expressionContext,
            naturalSentence: actualUse.naturalSentence,
          },
        }),
        this.prisma.targetVocabulary.updateMany({
          where: {
            userId,
            normalizedTerm,
            status: {
              in: [
                TargetVocabularyStatus.UNSEEN,
                TargetVocabularyStatus.PRACTICING,
              ],
            },
          },
          data: { status: TargetVocabularyStatus.USED },
        }),
      );
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }
  }

  // 由 Review 保存交易呼叫，避免場次已保存但單字只更新一部分。
  async applyRecordedReview(
    tx: Prisma.TransactionClient,
    userId: string,
    result: SpeakingRecordedResult,
    practicedAt: Date,
  ): Promise<void> {
    const events = [
      ...result.recommendations.map((entry) => ({
        ...entry,
        type: 'recommendation' as const,
      })),
      ...result.actualUses.map((entry) => ({
        ...entry,
        type: 'actual-use' as const,
      })),
    ];
    for (const event of events) {
      const word = await tx.targetVocabulary.findFirst({
        where: { id: event.targetVocabularyId, userId },
      });
      if (!word)
        throw new UnprocessableEntityException({
          error: {
            code: 'TARGET_NOT_FOUND',
            message: '目標單字已不存在，請重新 Review',
          },
        });
      const data: Prisma.TargetVocabularyUpdateInput = {
        status: nextVocabularyStatus(word.status, event.type),
        ...(event.type === 'actual-use'
          ? { useCount: { increment: 1 } }
          : { recommendationCount: { increment: 1 } }),
      };
      if (!word.lastExpressionAt || word.lastExpressionAt <= practicedAt) {
        data.expressionContext = event.expressionContext;
        data.naturalSentence = event.naturalSentence;
        data.lastExpressionAt = practicedAt;
      }
      if (
        'recommendationReason' in event &&
        (!word.lastRecommendationAt || word.lastRecommendationAt <= practicedAt)
      ) {
        data.recommendationReason = event.recommendationReason;
        data.lastRecommendationAt = practicedAt;
      }
      await tx.targetVocabulary.update({ where: { id: word.id }, data });
    }
  }

  async addToDeck(
    userId: string,
    targetVocabularyId: string,
    dto: AddTargetVocabularyToDeckDto,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const target = await transaction.targetVocabulary.findFirst({
        where: { id: targetVocabularyId, userId },
      });

      if (!target) {
        throw new NotFoundException({
          error: {
            code: 'TARGET_VOCABULARY_NOT_FOUND',
            message: '找不到此目標單字',
          },
        });
      }

      if (
        target.status === TargetVocabularyStatus.ADDED &&
        target.addedCardId
      ) {
        return { data: target };
      }

      if (target.status !== TargetVocabularyStatus.USED) {
        throw new UnprocessableEntityException({
          error: {
            code: 'TARGET_VOCABULARY_NOT_USED',
            message: '目標單字需先在 Speaking 實際使用後才能加入牌組',
          },
        });
      }

      const deck = await transaction.deck.findFirst({
        where: { id: dto.deckId, userId },
        select: { id: true },
      });

      if (!deck) {
        throw new NotFoundException({
          error: { code: 'DECK_NOT_FOUND', message: '找不到此牌組' },
        });
      }

      const normalizedTerm = this.normalizeTerm(dto.term);
      const cards = await transaction.card.findMany({
        where: { deck: { userId } },
        select: { id: true, front: true },
      });
      const existingCard = cards.find(
        (card) => this.normalizeTerm(card.front) === normalizedTerm,
      );
      const naturalSentence = dto.naturalSentence?.trim() || null;
      const zhExample = dto.zhExample?.trim() || null;
      const cardId = existingCard
        ? existingCard.id
        : (
            await transaction.card.create({
              data: {
                front: dto.term.trim(),
                note: null,
                deckId: deck.id,
                meanings: {
                  create: {
                    zhMeaning: dto.zhMeaning.trim(),
                    enExample: naturalSentence,
                    zhExample,
                    sortOrder: 0,
                  },
                },
              },
              select: { id: true },
            })
          ).id;

      const updated = await transaction.targetVocabulary.update({
        where: { id: targetVocabularyId },
        data: {
          status: TargetVocabularyStatus.ADDED,
          addedCardId: cardId,
          addedAt: new Date(),
        },
      });

      return { data: updated };
    });
  }

  async rejectActualUse(userId: string, targetVocabularyId: string) {
    const target = await this.prisma.targetVocabulary.findFirst({
      where: { id: targetVocabularyId, userId },
    });

    if (!target) {
      throw new NotFoundException({
        error: {
          code: 'TARGET_VOCABULARY_NOT_FOUND',
          message: '找不到此目標單字',
        },
      });
    }

    if (target.status !== TargetVocabularyStatus.USED) {
      throw new UnprocessableEntityException({
        error: {
          code: 'TARGET_VOCABULARY_NOT_USED',
          message: '只能撤銷尚未加入牌組的已使用單字',
        },
      });
    }

    const status =
      target.recommendationCount > 0
        ? TargetVocabularyStatus.PRACTICING
        : TargetVocabularyStatus.UNSEEN;
    const updated = await this.prisma.targetVocabulary.update({
      where: { id: targetVocabularyId },
      data: {
        status,
        useCount: 0,
        expressionContext: null,
        naturalSentence: null,
      },
    });

    return { data: updated };
  }

  private uniqueReviewItems<T extends { term: string }>(items: T[]): T[] {
    return [
      ...new Map(
        items.map((item) => [this.normalizeTerm(item.term), item]),
      ).values(),
    ];
  }

  private normalizeTerm(term: string): string {
    return term
      .normalize('NFKC')
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase();
  }

  private toStatus(status: TargetVocabularyStatusDto): TargetVocabularyStatus {
    return TargetVocabularyStatus[status];
  }
}
