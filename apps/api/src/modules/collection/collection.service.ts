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
        provider: 'OPENAI_AGENTS',
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

  async listChatMessages(userId: string, sessionId: string) {
    const session = await this.prisma.collectionChatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw this.notFound('找不到聊天 session');
    }

    return {
      data: session.messages.map((message) => {
        const metadata = this.parseChatMessageMetadata(message.metadata);

        return {
          id: message.id,
          role: message.role.toLowerCase(),
          content: message.content,
          intent: metadata.intent,
          candidates: metadata.candidates,
          suggestedCards: metadata.suggestedCards,
          createdAt: message.createdAt.toISOString(),
        };
      }),
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

  async createChatMessageStream(
    userId: string,
    sessionId: string,
    dto: CreateCollectionChatMessageDto,
    onMessageDelta: (delta: string) => void | Promise<void>,
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
      onMessageDelta,
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

  private parseChatMessageMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {
        intent: null,
        candidates: [],
        suggestedCards: [],
      };
    }

    const record = metadata as Record<string, unknown>;

    return {
      intent: typeof record['intent'] === 'string' ? record['intent'] : null,
      candidates: Array.isArray(record['candidates'])
        ? record['candidates']
        : [],
      suggestedCards: Array.isArray(record['suggestedCards'])
        ? record['suggestedCards']
        : [],
    };
  }

  private async mapChatSuggestions(
    userId: string,
    sessionId: string,
    candidates: CollectionAiCandidate[],
  ) {
    const sentenceCandidates = candidates.filter(
      (candidate) => candidate.kind === CollectionItemKindDto.SENTENCE,
    );
    const candidateTexts = sentenceCandidates.map(
      (candidate) => candidate.text,
    );
    const matchedCards = await this.tools.findUserCardsByCandidateTexts(
      userId,
      candidateTexts,
    );
    const matchedCardIds = matchedCards.map((card) => card.id);
    const sourceCardIds = [
      ...new Set(
        sentenceCandidates.flatMap(
          (candidate) => candidate.sourceCardIds ?? [],
        ),
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

    return sentenceCandidates
      .map((candidate, index) => {
        const candidateSourceCardIds = this.mergeCardIds(
          candidate.sourceCardIds ?? [],
          this.findMatchedCardIds(candidate.text, availableCards),
        );
        const sourceCards = candidateSourceCardIds
          .flatMap((cardId) => {
            const card = cardById.get(cardId);
            if (
              !card ||
              this.isLowValueSourceWord(this.tools.normalizeText(card.front))
            ) {
              return [];
            }

            return [card];
          })
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
          relatedCandidates: [],
        };
      })
      .filter((candidate) => candidate.kind === CollectionItemKindDto.SENTENCE);
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
        if (this.isLowValueSourceWord(normalizedFront)) return false;
        if (normalizedFront.includes(' ')) {
          return normalizedText.includes(normalizedFront);
        }

        return new RegExp(`\\b${this.escapeRegExp(normalizedFront)}s?\\b`).test(
          normalizedText,
        );
      })
      .map((card) => card.id);
  }

  private isLowValueSourceWord(normalizedFront: string): boolean {
    return new Set([
      'a',
      'an',
      'am',
      'are',
      'be',
      'been',
      'being',
      'can',
      'could',
      'did',
      'do',
      'does',
      'had',
      'has',
      'have',
      'he',
      'her',
      'him',
      'i',
      'is',
      'it',
      'may',
      'might',
      'no',
      'not',
      'of',
      'please',
      'she',
      'that',
      'the',
      'they',
      'this',
      'to',
      'was',
      'we',
      'were',
      'will',
      'with',
      'without',
      'would',
      'you',
    ]).has(normalizedFront);
  }

  private isUsableSourceCardId(
    cardId: string,
    cardById: Map<string, { id: string; front: string }>,
  ): boolean {
    const card = cardById.get(cardId);

    return Boolean(
      card && !this.isLowValueSourceWord(this.tools.normalizeText(card.front)),
    );
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
