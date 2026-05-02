import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionChatRole,
  CollectionItemKind,
  CollectionRelationType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CollectionItemKindDto,
  CollectionRelationTypeDto,
  CreateCollectionChatMessageDto,
  CreateCollectionItemDto,
  ListCollectionItemsDto,
} from './dto';
import {
  CollectionAiCandidate,
  CollectionAiProvider,
} from './collection-ai.provider';
import { CollectionToolService } from './collection-tool.service';

const DEFAULT_PAGE_LIMIT = 30;
const MAX_PAGE_LIMIT = 100;

type CollectionItemWithRelations = Prisma.CollectionItemGetPayload<{
  include: typeof COLLECTION_ITEM_INCLUDE;
}>;
type RelatedCollectionItem =
  CollectionItemWithRelations['parentRelations'][number]['child'];

const CARD_INCLUDE = {
  meanings: {
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
  },
};

const CARD_LINK_INCLUDE = {
  card: {
    include: CARD_INCLUDE,
  },
};

const COLLECTION_ITEM_INCLUDE = {
  cardLinks: {
    include: CARD_LINK_INCLUDE,
    orderBy: { createdAt: 'asc' as const },
  },
  parentRelations: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      child: {
        include: {
          cardLinks: {
            include: CARD_LINK_INCLUDE,
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
    },
  },
  childRelations: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      parent: {
        include: {
          cardLinks: {
            include: CARD_LINK_INCLUDE,
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
    },
  },
};

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: CollectionAiProvider,
    private readonly tools: CollectionToolService,
  ) {}

  async listItems(userId: string, query: ListCollectionItemsDto) {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
    const cursorId = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const where: Prisma.CollectionItemWhereInput = {
      userId,
      ...(query.kind ? { kind: this.toPrismaKind(query.kind) } : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { text: { contains: query.q.trim(), mode: 'insensitive' } },
              { zhMeaning: { contains: query.q.trim(), mode: 'insensitive' } },
              {
                cardLinks: {
                  some: {
                    card: {
                      front: { contains: query.q.trim(), mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const items = await this.prisma.collectionItem.findMany({
      where,
      include: COLLECTION_ITEM_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const visibleItems = hasMore ? items.slice(0, limit) : items;

    return {
      data: visibleItems.map((item) => this.mapItem(item)),
      meta: {
        hasMore,
        nextCursor: hasMore
          ? this.encodeCursor(visibleItems[visibleItems.length - 1].id)
          : null,
      },
    };
  }

  async createItem(userId: string, dto: CreateCollectionItemDto) {
    const item = await this.prisma.$transaction(async (tx) => {
      const rootItem = await this.upsertItem(tx, userId, {
        kind: dto.kind,
        text: dto.text,
        meaning: dto.meaning,
        note: dto.note,
        createdFrom: dto.createdFrom ?? 'manual',
      });

      await this.replaceCardLinks(
        tx,
        userId,
        rootItem.id,
        dto.sourceCardIds ?? [],
      );

      for (const [index, candidate] of (
        dto.relatedCandidates ?? []
      ).entries()) {
        const childItem = await this.upsertItem(tx, userId, {
          kind: candidate.kind,
          text: candidate.text,
          meaning: candidate.meaning,
          createdFrom: dto.createdFrom ?? 'ai_candidate',
        });
        await this.replaceCardLinks(
          tx,
          userId,
          childItem.id,
          candidate.sourceCardIds ?? [],
        );
        await tx.collectionItemRelation.upsert({
          where: {
            parentId_childId_type: {
              parentId: rootItem.id,
              childId: childItem.id,
              type: this.toPrismaRelationType(candidate.type),
            },
          },
          create: {
            parentId: rootItem.id,
            childId: childItem.id,
            type: this.toPrismaRelationType(candidate.type),
            sortOrder: index,
          },
          update: {
            sortOrder: index,
          },
        });
      }

      return tx.collectionItem.findUniqueOrThrow({
        where: { id: rootItem.id },
        include: COLLECTION_ITEM_INCLUDE,
      });
    });

    return { data: this.mapItem(item) };
  }

  async deleteItem(userId: string, id: string) {
    const item = await this.prisma.collectionItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!item) {
      throw this.notFound('找不到收藏項目');
    }

    await this.prisma.collectionItem.delete({
      where: { id },
    });
  }

  async createChatSession(userId: string) {
    const session = await this.prisma.collectionChatSession.create({
      data: {
        userId,
        provider: 'CODEX',
      },
    });

    return {
      data: {
        id: session.id,
        providerThreadId: session.providerThreadId,
        title: session.title,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
    };
  }

  async createChatMessage(
    userId: string,
    sessionId: string,
    dto: CreateCollectionChatMessageDto,
  ) {
    const session = await this.prisma.collectionChatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw this.notFound('找不到聊天 session');
    }

    await this.prisma.collectionChatMessage.create({
      data: {
        sessionId,
        role: CollectionChatRole.USER,
        content: dto.message,
      },
    });

    const result = await this.aiProvider.runChat({
      userId,
      sessionId,
      providerThreadId: session.providerThreadId,
      message: dto.message,
      intentHint: dto.intentHint,
    });

    await this.prisma.$transaction([
      this.prisma.collectionChatSession.update({
        where: { id: sessionId },
        data: {
          providerThreadId: result.providerThreadId ?? session.providerThreadId,
          updatedAt: new Date(),
        },
      }),
      this.prisma.collectionChatMessage.create({
        data: {
          sessionId,
          role: CollectionChatRole.ASSISTANT,
          content: result.message,
          metadata: result as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    const suggestions = await this.mapChatSuggestions(
      userId,
      sessionId,
      result.candidates,
    );

    return {
      data: {
        sessionId,
        userMessage: dto.message,
        assistantMessage: result.message,
        intent: result.intent,
        candidates: suggestions,
        suggestedCards: result.suggestedCards,
      },
    };
  }

  private async mapChatSuggestions(
    userId: string,
    sessionId: string,
    candidates: CollectionAiCandidate[],
  ) {
    const candidateTexts = candidates.flatMap((candidate) => [
      candidate.text,
      ...(candidate.relatedCandidates ?? []).map(
        (relatedCandidate) => relatedCandidate.text,
      ),
    ]);
    const matchedCards = await this.tools.findUserCardsByCandidateTexts(
      userId,
      candidateTexts,
    );
    const matchedCardIds = matchedCards.map((card) => card.id);
    const sourceCardIds = [
      ...new Set(
        candidates.flatMap((candidate) => [
          ...(candidate.sourceCardIds ?? []),
          ...(candidate.relatedCandidates ?? []).flatMap(
            (relatedCandidate) => relatedCandidate.sourceCardIds ?? [],
          ),
        ]),
      ),
    ];
    const cardsToFetch = [...new Set([...sourceCardIds, ...matchedCardIds])];
    const explicitCards = cardsToFetch.length
      ? await this.prisma.card.findMany({
          where: {
            id: { in: cardsToFetch },
            deck: { userId },
          },
          include: {
            meanings: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        })
      : [];
    const cardById = new Map(
      [...matchedCards, ...explicitCards].map((card) => [card.id, card]),
    );
    const availableCards = [...cardById.values()];

    return candidates
      .map((candidate, index) => {
        const relatedCandidates = (candidate.relatedCandidates ?? []).map(
          (relatedCandidate) => {
            const relatedSourceCardIds = this.mergeCardIds(
              relatedCandidate.sourceCardIds ?? [],
              this.findMatchedCardIds(relatedCandidate.text, availableCards),
            );

            return {
              type: relatedCandidate.type,
              kind: relatedCandidate.kind,
              text: relatedCandidate.text,
              meaning: relatedCandidate.meaning,
              sourceCardIds: relatedSourceCardIds.filter((cardId) =>
                cardById.has(cardId),
              ),
            };
          },
        );
        const candidateSourceCardIds = this.mergeCardIds(
          candidate.sourceCardIds ?? [],
          this.findMatchedCardIds(candidate.text, availableCards),
          candidate.kind === CollectionItemKindDto.SENTENCE
            ? relatedCandidates.flatMap(
                (relatedCandidate) => relatedCandidate.sourceCardIds,
              )
            : [],
        );
        const sourceCards = candidateSourceCardIds
          .map((cardId) => cardById.get(cardId))
          .filter((card): card is NonNullable<typeof card> => Boolean(card))
          .map((card) => ({
            id: card.id,
            text: card.front,
            meaning: card.meanings[0]?.zhMeaning ?? null,
          }));

        return {
          id: `${sessionId}-${Date.now()}-${index}`,
          kind: candidate.kind,
          text: candidate.text,
          meaning: candidate.meaning,
          sourceWord: candidate.sourceWord ?? null,
          sourceCards,
          existing: candidate.alreadySaved ?? false,
          added: false,
          collectionItemId: null,
          relatedCandidates,
        };
      })
      .filter(
        (candidate) =>
          candidate.kind === CollectionItemKindDto.SENTENCE ||
          candidate.sourceCards.length > 0,
      );
  }

  private mergeCardIds(...groups: string[][]): string[] {
    return [...new Set(groups.flat().filter((cardId) => cardId.length > 0))];
  }

  private findMatchedCardIds(
    text: string,
    cards: Array<{ id: string; front: string }>,
  ): string[] {
    const normalizedText = this.tools.normalizeText(text);

    return cards
      .filter((card) => {
        const normalizedFront = this.tools.normalizeText(card.front);
        if (!normalizedFront) return false;
        if (normalizedFront.includes(' ')) {
          return normalizedText.includes(normalizedFront);
        }

        return new RegExp(`\\b${this.escapeRegExp(normalizedFront)}s?\\b`).test(
          normalizedText,
        );
      })
      .map((card) => card.id);
  }

  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async upsertItem(
    tx: Prisma.TransactionClient,
    userId: string,
    input: {
      kind: CollectionItemKindDto;
      text: string;
      meaning?: string;
      note?: string;
      createdFrom?: string;
    },
  ) {
    const normalizedText = this.tools.normalizeText(input.text);
    if (!normalizedText) {
      throw this.validationError('收藏內容不可為空');
    }

    return tx.collectionItem.upsert({
      where: {
        userId_kind_normalizedText: {
          userId,
          kind: this.toPrismaKind(input.kind),
          normalizedText,
        },
      },
      create: {
        userId,
        kind: this.toPrismaKind(input.kind),
        text: input.text.trim(),
        normalizedText,
        zhMeaning: input.meaning?.trim() || null,
        note: input.note?.trim() || null,
        createdFrom: input.createdFrom ?? 'manual',
      },
      update: {
        text: input.text.trim(),
        zhMeaning: input.meaning?.trim() || undefined,
        note: input.note?.trim() || undefined,
      },
    });
  }

  private async replaceCardLinks(
    tx: Prisma.TransactionClient,
    userId: string,
    collectionItemId: string,
    sourceCardIds: string[],
  ) {
    if (sourceCardIds.length === 0) {
      return;
    }

    const uniqueCardIds = [...new Set(sourceCardIds)];
    const cards = await tx.card.findMany({
      where: {
        id: { in: uniqueCardIds },
        deck: { userId },
      },
      select: { id: true },
    });

    if (cards.length !== uniqueCardIds.length) {
      throw this.forbidden('無權限連結指定卡片');
    }

    await Promise.all(
      uniqueCardIds.map((cardId) =>
        tx.collectionItemCard.upsert({
          where: {
            collectionItemId_cardId_role: {
              collectionItemId,
              cardId,
              role: 'source',
            },
          },
          create: {
            collectionItemId,
            cardId,
            role: 'source',
          },
          update: {},
        }),
      ),
    );
  }

  private mapItem(item: CollectionItemWithRelations) {
    const sourceCards = item.cardLinks.map((link) => ({
      id: link.card.id,
      text: link.card.front,
      meaning: link.card.meanings[0]?.zhMeaning ?? null,
    }));

    const sourceWords = sourceCards.map((card) => card.text);

    return {
      id: item.id,
      kind: this.fromPrismaKind(item.kind),
      text: item.text,
      meaning: item.zhMeaning ?? '',
      note: item.note,
      sourceWords,
      sourceCards,
      breakdownItems: this.mapBreakdownItems(item),
      relatedChunks: this.mapRelatedChunks(item),
      relatedSentences: this.mapRelatedSentences(item),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private mapBreakdownItems(item: CollectionItemWithRelations) {
    if (item.kind !== CollectionItemKind.SENTENCE) {
      return [];
    }

    return item.parentRelations.map((relation) => ({
      id: relation.child.id,
      kind: this.fromPrismaKind(relation.child.kind),
      text: relation.child.text,
      meaning: relation.child.zhMeaning ?? '',
      sourceWord: relation.child.cardLinks[0]?.card.front ?? null,
      collectionItemId: relation.child.id,
    }));
  }

  private mapRelatedChunks(item: CollectionItemWithRelations) {
    if (item.kind === CollectionItemKind.SENTENCE) {
      return [];
    }

    if (item.kind === CollectionItemKind.COLLOCATION) {
      return item.childRelations
        .filter(
          (relation) => relation.parent.kind !== CollectionItemKind.SENTENCE,
        )
        .map((relation) => this.mapRelatedChunkItem(relation.parent));
    }

    return item.parentRelations.map((relation) =>
      this.mapRelatedChunkItem(relation.child),
    );
  }

  private mapRelatedChunkItem(relatedItem: RelatedCollectionItem) {
    return {
      id: relatedItem.id,
      kind: this.fromPrismaKind(relatedItem.kind),
      text: relatedItem.text,
      meaning: relatedItem.zhMeaning ?? '',
      collectionItemId: relatedItem.id,
    };
  }

  private mapRelatedSentences(item: CollectionItemWithRelations) {
    if (item.kind === CollectionItemKind.SENTENCE) {
      return [];
    }

    return item.childRelations
      .filter(
        (relation) => relation.parent.kind === CollectionItemKind.SENTENCE,
      )
      .map((relation) => ({
        id: relation.parent.id,
        text: relation.parent.text,
        meaning: relation.parent.zhMeaning ?? '',
        collectionItemId: relation.parent.id,
      }));
  }

  private toPrismaKind(kind: CollectionItemKindDto): CollectionItemKind {
    const mapping: Record<CollectionItemKindDto, CollectionItemKind> = {
      [CollectionItemKindDto.SENTENCE]: CollectionItemKind.SENTENCE,
      [CollectionItemKindDto.COLLOCATION]: CollectionItemKind.COLLOCATION,
      [CollectionItemKindDto.PHRASE]: CollectionItemKind.PHRASE,
      [CollectionItemKindDto.CLAUSE]: CollectionItemKind.CLAUSE,
    };

    return mapping[kind];
  }

  private fromPrismaKind(kind: CollectionItemKind): CollectionItemKindDto {
    const mapping: Record<CollectionItemKind, CollectionItemKindDto> = {
      [CollectionItemKind.SENTENCE]: CollectionItemKindDto.SENTENCE,
      [CollectionItemKind.COLLOCATION]: CollectionItemKindDto.COLLOCATION,
      [CollectionItemKind.PHRASE]: CollectionItemKindDto.PHRASE,
      [CollectionItemKind.CLAUSE]: CollectionItemKindDto.CLAUSE,
    };

    return mapping[kind];
  }

  private toPrismaRelationType(
    type: CollectionRelationTypeDto,
  ): CollectionRelationType {
    const mapping: Record<CollectionRelationTypeDto, CollectionRelationType> = {
      [CollectionRelationTypeDto.SENTENCE_HAS_COLLOCATION]:
        CollectionRelationType.SENTENCE_HAS_COLLOCATION,
      [CollectionRelationTypeDto.SENTENCE_HAS_PHRASE]:
        CollectionRelationType.SENTENCE_HAS_PHRASE,
      [CollectionRelationTypeDto.SENTENCE_HAS_CLAUSE]:
        CollectionRelationType.SENTENCE_HAS_CLAUSE,
      [CollectionRelationTypeDto.PHRASE_HAS_COLLOCATION]:
        CollectionRelationType.PHRASE_HAS_COLLOCATION,
      [CollectionRelationTypeDto.CLAUSE_HAS_COLLOCATION]:
        CollectionRelationType.CLAUSE_HAS_COLLOCATION,
    };

    return mapping[type];
  }

  private encodeCursor(id: string): string {
    return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): string {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        id?: unknown;
      };

      if (typeof parsed.id !== 'string') {
        throw new Error('Invalid cursor');
      }

      return parsed.id;
    } catch {
      throw this.validationError('cursor 格式錯誤');
    }
  }

  private validationError(message: string) {
    return new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
  }

  private forbidden(message: string) {
    return new ForbiddenException({
      error: {
        code: 'FORBIDDEN',
        message,
      },
    });
  }

  private notFound(message: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message,
      },
    });
  }
}
