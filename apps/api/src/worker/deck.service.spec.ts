import {
  DeckService,
  type DeckCounts,
  type DeckDetailRow,
  type DeckRow,
  type DeckStore,
} from './deck.service';

const now = new Date('2026-09-28T12:00:00.000Z');

function deck(overrides: Partial<DeckRow> = {}): DeckRow {
  return {
    id: 'deck-1',
    name: 'Words',
    userId: 'user-1',
    dailyNewCards: 20,
    dailyReviewCards: 100,
    dailyResetHour: 0,
    enableReverse: true,
    overrideDate: '2026-09-28T00:00:00.000Z',
    overrideNewCards: 30,
    overrideReviewCards: 120,
    ...overrides,
  };
}

function counts(overrides: Partial<DeckCounts> = {}): DeckCounts {
  return {
    totalCount: 10,
    newCount: 3,
    reviewCount: 2,
    reverseNewCount: 1,
    reverseReviewCount: 4,
    todayNewStudied: 2,
    todayReviewStudied: 3,
    ...overrides,
  };
}

function store(
  overrides: Partial<jest.Mocked<DeckStore>> = {},
): jest.Mocked<DeckStore> {
  return {
    listByUser: jest.fn().mockResolvedValue([]),
    countsForDeck: jest.fn().mockResolvedValue(counts()),
    findById: jest.fn().mockResolvedValue(null),
    lastStudiedAt: jest.fn().mockResolvedValue(null),
    insertDeck: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Worker DeckService', () => {
  it('沿用既有牌組的正反向計數和當日上限', async () => {
    const repository = store({
      listByUser: jest.fn().mockResolvedValue([deck()]),
      countsForDeck: jest.fn().mockResolvedValue(counts()),
    });

    const result = await new DeckService(repository, () => now).list(
      'user-1',
      'UTC',
    );

    expect(repository.countsForDeck).toHaveBeenCalledWith(
      'deck-1',
      '2026-09-28T00:00:00.000Z',
      now.toISOString(),
    );
    expect(result).toEqual([
      {
        id: 'deck-1',
        name: 'Words',
        newCount: 4,
        reviewCount: 6,
        totalCount: 10,
        completedCount: 7,
        progress: 70,
        enableReverse: true,
        dailyNewCards: 30,
        dailyReviewCards: 120,
        todayNewStudied: 2,
        todayReviewStudied: 3,
      },
    ]);
  });

  it('未啟用反向時不計入反向卡片', async () => {
    const repository = store({
      listByUser: jest
        .fn()
        .mockResolvedValue([
          deck({ enableReverse: false, overrideDate: null }),
        ]),
      countsForDeck: jest.fn().mockResolvedValue(counts()),
    });

    const result = await new DeckService(repository, () => now).list(
      'user-1',
      'UTC',
    );

    expect(result[0]).toMatchObject({
      newCount: 3,
      reviewCount: 2,
      dailyNewCards: 20,
      dailyReviewCards: 100,
    });
  });

  it('只讓擁有者讀取牌組詳情', async () => {
    const row: DeckDetailRow = {
      ...deck(),
      learningSteps: '1m,10m',
      relearningSteps: '10m',
      requestRetention: 0.9,
      maximumInterval: 36500,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const repository = store({
      findById: jest.fn().mockResolvedValue(row),
      lastStudiedAt: jest.fn().mockResolvedValue('2026-09-25T00:00:00.000Z'),
    });
    const service = new DeckService(repository, () => now);

    await expect(service.get('deck-1', 'someone-else')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(repository.countsForDeck).not.toHaveBeenCalled();

    const result = await service.get('deck-1', 'user-1');
    expect(result.stats).toEqual({
      newCount: 4,
      reviewCount: 6,
      totalCount: 10,
      createdAt: '2026-09-01T00:00:00.000Z',
      lastStudiedAt: '2026-09-25T00:00:00.000Z',
    });
  });

  it('建立牌組時使用現有預設設定', async () => {
    const repository = store();
    const result = await new DeckService(repository, () => now).create(
      'user-1',
      { name: 'New' },
    );

    expect(repository.insertDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        name: 'New',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        dailyResetHour: 4,
        enableReverse: false,
      }),
    );
    expect(result.data.name).toBe('New');
  });
});
