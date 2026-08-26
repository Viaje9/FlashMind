import { TargetVocabularyStatus } from '@prisma/client';

import { TargetVocabularyService } from './target-vocabulary.service';

describe('TargetVocabularyService', () => {
  function createService() {
    const prisma = {
      targetVocabulary: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      card: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      deck: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (input: unknown) => {
        if (typeof input === 'function') {
          return (input as (client: typeof prisma) => unknown)(prisma);
        }
        return Promise.all(input as Promise<unknown>[]);
      }),
    };

    return {
      prisma,
      service: new TargetVocabularyService(prisma as never),
    };
  }

  it('匯入時排除目標庫與牌組內已有的單字', async () => {
    const { service, prisma } = createService();
    prisma.targetVocabulary.findMany.mockResolvedValue([
      { normalizedTerm: 'figure out' },
    ]);
    prisma.card.findMany.mockResolvedValue([{ front: 'Cooperation' }]);
    prisma.targetVocabulary.createMany.mockResolvedValue({ count: 1 });

    const result = await service.importWords('user-1', {
      words: [
        { term: 'cooperation', zhMeaning: '合作' },
        { term: 'Figure   Out', zhMeaning: '弄清楚' },
        { term: 'function', zhMeaning: '功能' },
        { term: 'FUNCTION', zhMeaning: '功能' },
      ],
    });

    expect(prisma.targetVocabulary.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'user-1',
          term: 'function',
          normalizedTerm: 'function',
          status: TargetVocabularyStatus.UNSEEN,
        }),
      ],
      skipDuplicates: true,
    });
    expect(result.data).toEqual({
      total: 4,
      added: 1,
      alreadyInTargets: 2,
      alreadyInCards: 1,
    });
  });

  it('列出目前使用者的目標單字並支援狀態與搜尋', async () => {
    const { service, prisma } = createService();
    prisma.targetVocabulary.findMany.mockResolvedValue([]);

    await service.listWords('user-1', {
      status: 'PRACTICING',
      q: ' figure ',
    });

    expect(prisma.targetVocabulary.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: TargetVocabularyStatus.PRACTICING,
        OR: [
          { term: { contains: 'figure', mode: 'insensitive' } },
          { zhMeaning: { contains: 'figure', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('套用 Review 時應更新推薦與實際使用狀態及次數', async () => {
    const { service, prisma } = createService();

    await service.applyReview('user-1', {
      recommendations: [
        {
          term: 'cooperation',
          expressionContext: '描述自己和 AI 一起完成工作的方式。',
          naturalSentence: 'This is a cooperation between me and the AI agent.',
          recommendationReason: '能更完整描述這次的協作方式。',
        },
      ],
      actualUses: [
        {
          term: 'function',
          expressionContext: '依 node tree 需要的功能決定如何調整。',
          naturalSentence:
            'It depends on what kind of function the node tree needs.',
        },
      ],
    });

    expect(prisma.targetVocabulary.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', normalizedTerm: 'cooperation' },
      data: {
        recommendationCount: { increment: 1 },
        expressionContext: '描述自己和 AI 一起完成工作的方式。',
        naturalSentence: 'This is a cooperation between me and the AI agent.',
        recommendationReason: '能更完整描述這次的協作方式。',
      },
    });
    expect(prisma.targetVocabulary.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        normalizedTerm: 'cooperation',
        status: TargetVocabularyStatus.UNSEEN,
      },
      data: { status: TargetVocabularyStatus.PRACTICING },
    });
    expect(prisma.targetVocabulary.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', normalizedTerm: 'function' },
      data: {
        useCount: { increment: 1 },
        expressionContext: '依 node tree 需要的功能決定如何調整。',
        naturalSentence:
          'It depends on what kind of function the node tree needs.',
      },
    });
    expect(prisma.targetVocabulary.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        normalizedTerm: 'function',
        status: {
          in: [
            TargetVocabularyStatus.UNSEEN,
            TargetVocabularyStatus.PRACTICING,
          ],
        },
      },
      data: { status: TargetVocabularyStatus.USED },
    });
  });

  it('加入牌組時若使用者已有相同正規化單字，只連結既有卡片', async () => {
    const { service, prisma } = createService();
    prisma.targetVocabulary.findFirst.mockResolvedValue({
      id: 'target-1',
      userId: 'user-1',
      status: TargetVocabularyStatus.USED,
    });
    prisma.deck.findFirst.mockResolvedValue({ id: 'deck-1' });
    prisma.card.findMany.mockResolvedValue([
      { id: 'card-existing', front: ' Cooperation ' },
    ]);
    prisma.targetVocabulary.update.mockResolvedValue({
      id: 'target-1',
      status: TargetVocabularyStatus.ADDED,
      addedCardId: 'card-existing',
    });

    const result = await service.addToDeck('user-1', 'target-1', {
      deckId: 'deck-1',
      term: 'cooperation',
      zhMeaning: '合作；協作',
      naturalSentence: 'This is cooperation between me and the AI agent.',
    });

    expect(prisma.card.create).not.toHaveBeenCalled();
    expect(prisma.targetVocabulary.update).toHaveBeenCalledWith({
      where: { id: 'target-1' },
      data: {
        status: TargetVocabularyStatus.ADDED,
        addedCardId: 'card-existing',
        addedAt: expect.any(Date),
      },
    });
    expect(result.data.addedCardId).toBe('card-existing');
  });

  it('加入牌組時若沒有既有單字卡，應以可編輯內容建立新卡', async () => {
    const { service, prisma } = createService();
    prisma.targetVocabulary.findFirst.mockResolvedValue({
      id: 'target-1',
      userId: 'user-1',
      status: TargetVocabularyStatus.USED,
    });
    prisma.deck.findFirst.mockResolvedValue({ id: 'deck-1' });
    prisma.card.findMany.mockResolvedValue([]);
    prisma.card.create.mockResolvedValue({ id: 'card-new' });
    prisma.targetVocabulary.update.mockResolvedValue({
      id: 'target-1',
      status: TargetVocabularyStatus.ADDED,
      addedCardId: 'card-new',
    });

    await service.addToDeck('user-1', 'target-1', {
      deckId: 'deck-1',
      term: 'function',
      zhMeaning: '功能',
      naturalSentence:
        'It depends on what kind of function the node tree needs.',
    });

    expect(prisma.card.create).toHaveBeenCalledWith({
      data: {
        front: 'function',
        note: null,
        deckId: 'deck-1',
        meanings: {
          create: {
            zhMeaning: '功能',
            enExample:
              'It depends on what kind of function the node tree needs.',
            sortOrder: 0,
          },
        },
      },
      select: { id: true },
    });
  });
});
