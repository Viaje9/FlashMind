import {
  CollectionChatRole,
  CollectionItemKind,
  CollectionRelationType,
} from '@prisma/client';

import { CollectionService } from './collection.service';
import { CollectionChatIntent } from './collection-ai.provider';
import { CollectionItemKindDto, CollectionRelationTypeDto } from './dto';

describe('CollectionService', () => {
  function createItemFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'item-1',
      userId: 'user-1',
      kind: CollectionItemKind.SENTENCE,
      text: 'We started to fall behind schedule.',
      normalizedText: 'we started to fall behind schedule.',
      zhMeaning: '我們開始進度落後。',
      note: null,
      createdFrom: 'manual',
      createdAt: new Date('2026-05-02T00:00:00.000Z'),
      updatedAt: new Date('2026-05-02T00:00:00.000Z'),
      cardLinks: [],
      parentRelations: [],
      childRelations: [],
      ...overrides,
    };
  }

  function createService() {
    const tx = {
      collectionItem: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce({ id: 'sentence-1' })
          .mockResolvedValueOnce({ id: 'chunk-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createItemFixture()),
      },
      card: {
        findMany: jest.fn().mockResolvedValue([{ id: 'card-1' }]),
      },
      collectionItemCard: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      collectionItemRelation: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (input: unknown) => {
        if (typeof input === 'function') {
          return input(tx);
        }

        return Promise.all(input as Promise<unknown>[]);
      }),
      collectionItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      card: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      collectionChatSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      collectionChatMessage: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const aiProvider = {
      runChat: jest.fn(),
    };
    const tools = {
      normalizeText: (text: string) =>
        text
          .normalize('NFKC')
          .replace(/[’‘]/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase(),
    };

    return {
      tx,
      prisma,
      aiProvider,
      service: new CollectionService(
        prisma as any,
        aiProvider as any,
        tools as any,
      ),
    };
  }

  it('保存候選時會 upsert 本體、關聯語塊、來源卡片與 relation', async () => {
    const { service, tx } = createService();

    await service.createItem('user-1', {
      kind: CollectionItemKindDto.SENTENCE,
      text: ' We started to fall behind schedule. ',
      meaning: '我們開始進度落後。',
      sourceCardIds: ['card-1'],
      relatedCandidates: [
        {
          kind: CollectionItemKindDto.COLLOCATION,
          text: 'fall behind schedule',
          meaning: '進度落後',
          type: CollectionRelationTypeDto.SENTENCE_HAS_COLLOCATION,
          sourceCardIds: ['card-1'],
        },
      ],
    });

    expect(tx.collectionItem.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          userId_kind_normalizedText: {
            userId: 'user-1',
            kind: CollectionItemKind.SENTENCE,
            normalizedText: 'we started to fall behind schedule.',
          },
        },
      }),
    );
    expect(tx.collectionItem.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          userId_kind_normalizedText: {
            userId: 'user-1',
            kind: CollectionItemKind.COLLOCATION,
            normalizedText: 'fall behind schedule',
          },
        },
      }),
    );
    expect(tx.collectionItemCard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectionItemId_cardId_role: {
            collectionItemId: 'sentence-1',
            cardId: 'card-1',
            role: 'source',
          },
        },
      }),
    );
    expect(tx.collectionItemRelation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId_childId_type: {
            parentId: 'sentence-1',
            childId: 'chunk-1',
            type: CollectionRelationType.SENTENCE_HAS_COLLOCATION,
          },
        },
      }),
    );
  });

  it('送出聊天訊息會保存 user/assistant 訊息，且 TRANSLATE_ONLY 不回收藏候選', async () => {
    const { service, prisma, aiProvider } = createService();
    prisma.collectionChatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      providerThreadId: 'thread-1',
    });
    aiProvider.runChat.mockResolvedValue({
      providerThreadId: 'thread-1',
      intent: CollectionChatIntent.TRANSLATE_ONLY,
      message: '這是單純翻譯。',
      candidates: [],
      suggestedCards: [],
    });

    const result = await service.createChatMessage('user-1', 'session-1', {
      message: '翻譯：我想延期會議',
    });

    expect(prisma.collectionChatMessage.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        role: CollectionChatRole.USER,
        content: '翻譯：我想延期會議',
      },
    });
    expect(aiProvider.runChat).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        providerThreadId: 'thread-1',
      }),
    );
    expect(result.data.intent).toBe(CollectionChatIntent.TRANSLATE_ONLY);
    expect(result.data.candidates).toEqual([]);
  });

  it('聊天候選會帶回來源卡片與可保存的關聯拆解，並保留句子底下的新語塊', async () => {
    const { service, prisma, aiProvider } = createService();
    prisma.collectionChatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      providerThreadId: 'thread-1',
    });
    prisma.card.findMany.mockResolvedValue([
      {
        id: 'card-schedule',
        front: 'schedule',
        meanings: [{ zhMeaning: '時程' }],
      },
    ]);
    aiProvider.runChat.mockResolvedValue({
      providerThreadId: 'thread-1',
      intent: CollectionChatIntent.ANALYZE_SENTENCE,
      message: '可以收藏整句，並拆出和 schedule 有關的語塊。',
      candidates: [
        {
          kind: CollectionItemKindDto.SENTENCE,
          text: 'We started to fall behind schedule.',
          meaning: '我們開始進度落後。',
          sourceCardIds: ['card-schedule'],
          relatedCandidates: [
            {
              type: CollectionRelationTypeDto.SENTENCE_HAS_COLLOCATION,
              kind: CollectionItemKindDto.COLLOCATION,
              text: 'fall behind schedule',
              meaning: '進度落後',
              sourceCardIds: ['card-schedule'],
            },
            {
              type: CollectionRelationTypeDto.SENTENCE_HAS_PHRASE,
              kind: CollectionItemKindDto.PHRASE,
              text: 'after falling behind schedule',
              meaning: '在進度落後之後',
              sourceCardIds: [],
            },
          ],
        },
        {
          kind: CollectionItemKindDto.PHRASE,
          text: 'for dinner',
          meaning: '晚餐時',
          sourceCardIds: [],
        },
      ],
      suggestedCards: [],
    });

    const result = await service.createChatMessage('user-1', 'session-1', {
      message: '我們開始進度落後',
    });

    expect(result.data.candidates).toHaveLength(1);
    expect(result.data.candidates[0]).toEqual(
      expect.objectContaining({
        kind: CollectionItemKindDto.SENTENCE,
        sourceCards: [
          {
            id: 'card-schedule',
            text: 'schedule',
            meaning: '時程',
          },
        ],
        relatedCandidates: [
          {
            type: CollectionRelationTypeDto.SENTENCE_HAS_COLLOCATION,
            kind: CollectionItemKindDto.COLLOCATION,
            text: 'fall behind schedule',
            meaning: '進度落後',
            sourceCardIds: ['card-schedule'],
          },
          {
            type: CollectionRelationTypeDto.SENTENCE_HAS_PHRASE,
            kind: CollectionItemKindDto.PHRASE,
            text: 'after falling behind schedule',
            meaning: '在進度落後之後',
            sourceCardIds: [],
          },
        ],
      }),
    );
  });
});
