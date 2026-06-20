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
        create: jest.fn(),
      },
      cardMeaning: {
        create: jest.fn(),
        createMany: jest.fn(),
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
      findUserCardsByCandidateTexts: jest.fn().mockResolvedValue([]),
    };

    return {
      tx,
      prisma,
      aiProvider,
      tools,
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

  it('重新取得聊天訊息時會回傳 assistant metadata 中的 suggestedCards', async () => {
    const { service, prisma } = createService();
    prisma.collectionChatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      messages: [
        {
          id: 'message-user',
          role: CollectionChatRole.USER,
          content: '我需要在餐廳訂滿之前先訂位',
          metadata: null,
          createdAt: new Date('2026-05-02T00:00:00.000Z'),
        },
        {
          id: 'message-assistant',
          role: CollectionChatRole.ASSISTANT,
          content: '可以收藏整句，也建議補 restaurant。',
          metadata: {
            intent: CollectionChatIntent.SUGGEST_CANDIDATES,
            candidates: [],
            suggestedCards: [
              {
                id: 'suggest-restaurant',
                front: 'restaurant',
                meanings: [{ zhMeaning: '餐廳' }],
                reason: '這是句子的主要情境字。',
                existingCardId: null,
                added: false,
              },
            ],
          },
          createdAt: new Date('2026-05-02T00:00:01.000Z'),
        },
      ],
    });

    const result = await service.listChatMessages('user-1', 'session-1');

    expect(prisma.collectionChatSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    expect(result.data).toEqual([
      {
        id: 'message-user',
        role: 'user',
        content: '我需要在餐廳訂滿之前先訂位',
        intent: null,
        candidates: [],
        suggestedCards: [],
        createdAt: '2026-05-02T00:00:00.000Z',
      },
      {
        id: 'message-assistant',
        role: 'assistant',
        content: '可以收藏整句，也建議補 restaurant。',
        intent: CollectionChatIntent.SUGGEST_CANDIDATES,
        candidates: [],
        suggestedCards: [
          {
            id: 'suggest-restaurant',
            front: 'restaurant',
            meanings: [{ zhMeaning: '餐廳' }],
            reason: '這是句子的主要情境字。',
            existingCardId: null,
            added: false,
          },
        ],
        createdAt: '2026-05-02T00:00:01.000Z',
      },
    ]);
  });

  it('聊天 AI 回覆中的 suggestedCards 會保存於 assistant metadata 並原樣回傳', async () => {
    const { service, prisma, aiProvider } = createService();
    const suggestedCards = [
      {
        id: 'suggest-restaurant',
        front: 'restaurant',
        meanings: [
          {
            zhMeaning: '餐廳',
            enExample: 'I need to make a reservation at the restaurant.',
            zhExample: '我需要在那間餐廳訂位。',
          },
        ],
        reason: '這是句子的主要情境字，目前找不到對應單字卡。',
        existingCardId: null,
        added: false,
      },
    ];
    prisma.collectionChatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      providerThreadId: 'thread-1',
    });
    aiProvider.runChat.mockResolvedValue({
      providerThreadId: 'thread-1',
      intent: CollectionChatIntent.SUGGEST_CANDIDATES,
      message: '可以收藏整句，也建議補 restaurant。',
      candidates: [],
      suggestedCards,
    });

    const result = await service.createChatMessage('user-1', 'session-1', {
      message: '我需要在餐廳訂滿之前先訂位',
    });

    expect(prisma.collectionChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 'session-1',
        role: CollectionChatRole.ASSISTANT,
        content: '可以收藏整句，也建議補 restaurant。',
        metadata: expect.objectContaining({
          suggestedCards,
        }),
      }),
    });
    expect(result.data.suggestedCards).toEqual(suggestedCards);
    expect(prisma.card.create).not.toHaveBeenCalled();
    expect(prisma.cardMeaning.create).not.toHaveBeenCalled();
    expect(prisma.cardMeaning.createMany).not.toHaveBeenCalled();
  });

  it('串流聊天會傳遞 assistant delta callback 並保存完整回覆', async () => {
    const { service, prisma, aiProvider } = createService();
    const onMessageDelta = jest.fn();
    prisma.collectionChatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      providerThreadId: 'thread-1',
    });
    aiProvider.runChat.mockImplementation(async (input) => {
      await input.onMessageDelta('可以說 ');
      await input.onMessageDelta("I'm full.");

      return {
        providerThreadId: 'thread-2',
        intent: CollectionChatIntent.SUGGEST_CANDIDATES,
        message: "可以說 I'm full. 建議新增核心單字 full。",
        candidates: [],
        suggestedCards: [],
      };
    });

    const result = await service.createChatMessageStream(
      'user-1',
      'session-1',
      {
        message: '我吃飽了',
      },
      onMessageDelta,
    );

    expect(onMessageDelta).toHaveBeenCalledWith('可以說 ');
    expect(onMessageDelta).toHaveBeenCalledWith("I'm full.");
    expect(aiProvider.runChat).toHaveBeenCalledWith(
      expect.objectContaining({
        onMessageDelta,
      }),
    );
    expect(prisma.collectionChatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        providerThreadId: 'thread-2',
        updatedAt: expect.any(Date),
      },
    });
    expect(result.data.assistantMessage).toBe(
      "可以說 I'm full. 建議新增核心單字 full。",
    );
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
            sourceCardIds: ['card-schedule'],
          },
        ],
      }),
    );
  });

  it('聊天候選缺少 sourceCardIds 時會依候選文字自動連結既有單字卡', async () => {
    const { service, prisma, aiProvider, tools } = createService();
    prisma.collectionChatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      providerThreadId: 'thread-1',
    });
    tools.findUserCardsByCandidateTexts.mockResolvedValue([
      {
        id: 'card-price',
        front: 'price',
        meanings: [{ zhMeaning: '價格' }],
      },
    ]);
    prisma.card.findMany.mockResolvedValue([]);
    aiProvider.runChat.mockResolvedValue({
      providerThreadId: 'thread-1',
      intent: CollectionChatIntent.ANALYZE_SENTENCE,
      message: '可以收藏整句，也能拆出 compare prices。',
      candidates: [
        {
          kind: CollectionItemKindDto.SENTENCE,
          text: 'I want to compare prices and find a good deal before I buy.',
          meaning: '我想比較價格並在購買前找到好優惠。',
          sourceCardIds: [],
          relatedCandidates: [
            {
              type: CollectionRelationTypeDto.SENTENCE_HAS_COLLOCATION,
              kind: CollectionItemKindDto.COLLOCATION,
              text: 'compare prices',
              meaning: '比較價格',
              sourceCardIds: [],
            },
          ],
        },
        {
          kind: CollectionItemKindDto.COLLOCATION,
          text: 'compare prices',
          meaning: '比較價格',
          sourceCardIds: [],
        },
      ],
      suggestedCards: [],
    });

    const result = await service.createChatMessage('user-1', 'session-1', {
      message: '我想比較價格並找到好優惠',
    });

    expect(tools.findUserCardsByCandidateTexts).toHaveBeenCalledWith('user-1', [
      'I want to compare prices and find a good deal before I buy.',
      'compare prices',
      'compare prices',
    ]);
    expect(result.data.candidates).toHaveLength(2);
    expect(result.data.candidates[0]).toEqual(
      expect.objectContaining({
        kind: CollectionItemKindDto.SENTENCE,
        sourceCards: [
          {
            id: 'card-price',
            text: 'price',
            meaning: '價格',
          },
        ],
        relatedCandidates: [
          expect.objectContaining({
            text: 'compare prices',
            sourceCardIds: ['card-price'],
          }),
        ],
      }),
    );
    expect(result.data.candidates[1]).toEqual(
      expect.objectContaining({
        kind: CollectionItemKindDto.COLLOCATION,
        text: 'compare prices',
        sourceCards: [
          {
            id: 'card-price',
            text: 'price',
            meaning: '價格',
          },
        ],
      }),
    );
  });

  it('聊天候選不應把功能字、禮貌詞或介系詞當成來源單字卡', async () => {
    const { service, prisma, aiProvider, tools } = createService();
    prisma.collectionChatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      providerThreadId: 'thread-1',
    });
    tools.findUserCardsByCandidateTexts.mockResolvedValue([
      {
        id: 'card-no',
        front: 'no',
        meanings: [{ zhMeaning: '不要' }],
      },
      {
        id: 'card-please',
        front: 'please',
        meanings: [{ zhMeaning: '請' }],
      },
      {
        id: 'card-without',
        front: 'without',
        meanings: [{ zhMeaning: '沒有' }],
      },
    ]);
    prisma.card.findMany.mockResolvedValue([
      {
        id: 'card-no',
        front: 'no',
        meanings: [{ zhMeaning: '不要' }],
      },
      {
        id: 'card-please',
        front: 'please',
        meanings: [{ zhMeaning: '請' }],
      },
      {
        id: 'card-without',
        front: 'without',
        meanings: [{ zhMeaning: '沒有' }],
      },
    ]);
    aiProvider.runChat.mockResolvedValue({
      providerThreadId: 'thread-1',
      intent: CollectionChatIntent.SUGGEST_CANDIDATES,
      message: '可以說 No sauce, please.',
      candidates: [
        {
          kind: CollectionItemKindDto.SENTENCE,
          text: 'No sauce, please.',
          meaning: '不要醬，謝謝。',
          sourceCardIds: ['card-no', 'card-please'],
          relatedCandidates: [
            {
              type: CollectionRelationTypeDto.SENTENCE_HAS_PHRASE,
              kind: CollectionItemKindDto.PHRASE,
              text: 'without sauce',
              meaning: '不要醬；不加醬',
              sourceCardIds: ['card-without'],
            },
          ],
        },
      ],
      suggestedCards: [
        {
          id: 'suggest-sauce',
          front: 'sauce',
          meanings: [{ zhMeaning: '醬' }],
          reason: '點餐時表達不要醬的核心名詞。',
          existingCardId: null,
          added: false,
        },
      ],
    });

    const result = await service.createChatMessage('user-1', 'session-1', {
      message: '我在餐廳點餐我想跟服務生說「不要醬」可以怎麼說',
    });

    expect(result.data.candidates[0]).toEqual(
      expect.objectContaining({
        text: 'No sauce, please.',
        sourceCards: [],
        relatedCandidates: [
          expect.objectContaining({
            text: 'without sauce',
            sourceCardIds: [],
          }),
        ],
      }),
    );
    expect(result.data.suggestedCards).toEqual([
      expect.objectContaining({
        front: 'sauce',
        meanings: [{ zhMeaning: '醬' }],
      }),
    ]);
  });
});
