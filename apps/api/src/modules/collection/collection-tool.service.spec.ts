import { CollectionToolService } from './collection-tool.service';

describe('CollectionToolService', () => {
  function createService() {
    const prisma = {
      card: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      collectionItem: {
        findMany: jest.fn(),
      },
    };

    return {
      prisma,
      service: new CollectionToolService(prisma as any),
    };
  }

  it('查詢使用者單字卡時會限制 deck.userId', async () => {
    const { prisma, service } = createService();
    prisma.card.findMany.mockResolvedValue([]);

    await service.listUserCards('user-1', 12);

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deck: { userId: 'user-1' } },
        take: 12,
        include: expect.objectContaining({
          meanings: expect.objectContaining({ take: 1 }),
        }),
      }),
    );
  });

  it('搜尋單字卡時會查 Card.front 與 CardMeaning.zhMeaning', async () => {
    const { prisma, service } = createService();
    prisma.card.findMany.mockResolvedValue([]);

    await service.searchUserCards('user-1', '進度', 5);

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deck: { userId: 'user-1' },
          OR: [
            { front: { contains: '進度', mode: 'insensitive' } },
            {
              meanings: {
                some: {
                  zhMeaning: { contains: '進度', mode: 'insensitive' },
                },
              },
            },
          ],
        },
        take: 5,
      }),
    );
  });

  it('搜尋收藏時會限制使用者並比對英文與中文', async () => {
    const { prisma, service } = createService();
    prisma.collectionItem.findMany.mockResolvedValue([]);

    await service.searchCollectionItems('user-1', 'schedule', 7);

    expect(prisma.collectionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          OR: [
            { text: { contains: 'schedule', mode: 'insensitive' } },
            { zhMeaning: { contains: 'schedule', mode: 'insensitive' } },
          ],
        },
        take: 7,
      }),
    );
  });

  it('彙整單字摘要時會回傳總數與樣本卡片', async () => {
    const { prisma, service } = createService();
    prisma.card.count.mockResolvedValue(3);
    prisma.card.findMany.mockResolvedValue([{ id: 'card-1' }]);

    const result = await service.getUserVocabularySummary('user-1', 1);

    expect(prisma.card.count).toHaveBeenCalledWith({
      where: { deck: { userId: 'user-1' } },
    });
    expect(result).toEqual({
      totalCards: 3,
      sampleCards: [{ id: 'card-1' }],
    });
  });

  it('比對既有收藏前會正規化文字', async () => {
    const { prisma, service } = createService();
    prisma.collectionItem.findMany.mockResolvedValue([]);

    await service.findCollectionItemsByText('user-1', [
      ' Fall   Behind  Schedule ',
      'can’t use this',
    ]);

    expect(prisma.collectionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          normalizedText: {
            in: ['fall behind schedule', "can't use this"],
          },
        },
      }),
    );
  });
});
