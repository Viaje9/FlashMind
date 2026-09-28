import { CardService, type CardRow, type CardStore } from './card.service';
import { FsrsService } from '../modules/fsrs/fsrs.service';

function card(): CardRow {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    front: 'apple',
    summary: '蘋果',
    note: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    state: 'NEW',
    due: null,
    stability: null,
    difficulty: null,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    learningStep: 0,
    reverseState: 'NEW',
    reverseDue: null,
    reverseStability: null,
    reverseDifficulty: null,
    reverseElapsedDays: 0,
    reverseScheduledDays: 0,
    reverseReps: 0,
    reverseLapses: 0,
    reverseLastReview: null,
    reverseLearningStep: 0,
  };
}

function store(): jest.Mocked<CardStore> {
  return {
    findDeck: jest
      .fn()
      .mockResolvedValue({ userId: 'user-1', enableReverse: false }),
    listCards: jest.fn().mockResolvedValue([card()]),
    findCard: jest.fn().mockResolvedValue(card()),
    listMeanings: jest.fn().mockResolvedValue([
      {
        id: 'meaning-1',
        zhMeaning: '蘋果',
        enExample: null,
        zhExample: null,
      },
    ]),
    insertCard: jest.fn().mockResolvedValue(undefined),
    updateCard: jest.fn().mockResolvedValue(undefined),
    deleteCard: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Worker CardService', () => {
  it('列表保留既有正向卡片格式', async () => {
    const service = new CardService(store());
    expect(await service.list('deck-1', 'user-1')).toEqual([
      {
        id: 'card-1',
        cardId: 'card-1',
        direction: 'FORWARD',
        front: 'apple',
        summary: '蘋果',
        state: 'NEW',
        due: null,
        proficiency: null,
      },
    ]);
  });

  it('啟用反向時為每張卡片產生兩個方向', async () => {
    const repository = store();
    repository.findDeck.mockResolvedValue({
      userId: 'user-1',
      enableReverse: true,
    });
    const result = await new CardService(repository).list('deck-1', 'user-1');
    expect(result.map((item) => [item.id, item.direction])).toEqual([
      ['card-1', 'FORWARD'],
      ['card-1:REVERSE', 'REVERSE'],
    ]);
  });

  it('拒絕讀取他人的牌組', async () => {
    const repository = store();
    await expect(
      new CardService(repository).list('deck-1', 'other'),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(repository.listCards).not.toHaveBeenCalled();
  });

  it('詳情帶回排序後的釋義', async () => {
    const result = await new CardService(store()).get(
      'card-1',
      'deck-1',
      'user-1',
    );
    expect(result).toMatchObject({
      id: 'card-1',
      front: 'apple',
      meanings: [{ id: 'meaning-1', zhMeaning: '蘋果' }],
    });
  });

  it('熟練度與既有 FSRS 計算一致', async () => {
    const repository = store();
    const scheduled = {
      ...card(),
      state: 'REVIEW' as const,
      due: '2026-09-29T00:00:00.000Z',
      stability: 10,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 10,
      reps: 2,
      lastReview: '2026-09-27T00:00:00.000Z',
    };
    repository.listCards.mockResolvedValue([scheduled]);
    const now = new Date('2026-09-28T00:00:00.000Z');
    const legacy = new FsrsService().calculateProficiency(
      {
        state: scheduled.state,
        due: new Date(scheduled.due),
        stability: scheduled.stability,
        difficulty: scheduled.difficulty,
        elapsedDays: scheduled.elapsedDays,
        scheduledDays: scheduled.scheduledDays,
        reps: scheduled.reps,
        lapses: scheduled.lapses,
        lastReview: new Date(scheduled.lastReview),
        learningStep: scheduled.learningStep,
      },
      now,
    );

    const result = await new CardService(repository, () => now).list(
      'deck-1',
      'user-1',
    );
    expect(result[0].proficiency).toBe(legacy);
  });

  it('建立卡片時規範化空白備註並保存釋義順序', async () => {
    const repository = store();
    const result = await new CardService(repository).create(
      'deck-1',
      'user-1',
      {
        front: 'apple',
        note: '   ',
        meanings: [
          { zhMeaning: '蘋果' },
          { zhMeaning: '蘋果樹', enExample: 'An apple tree.' },
        ],
      },
    );

    expect(repository.insertCard).toHaveBeenCalledWith(
      expect.objectContaining({ note: null, deckId: 'deck-1' }),
      expect.arrayContaining([
        expect.objectContaining({ zhMeaning: '蘋果', sortOrder: 0 }),
        expect.objectContaining({ zhMeaning: '蘋果樹', sortOrder: 1 }),
      ]),
    );
    expect(result.data.meanings).toHaveLength(2);
  });

  it('更新釋義時傳遞完整新內容供 D1 一次交易取代', async () => {
    const repository = store();
    const result = await new CardService(repository).update(
      'card-1',
      'deck-1',
      'user-1',
      {
        note: 'updated',
        meanings: [{ zhMeaning: '新釋義' }],
      },
    );

    expect(repository.updateCard).toHaveBeenCalledWith(
      'card-1',
      'deck-1',
      expect.objectContaining({ front: 'apple', note: 'updated' }),
      expect.arrayContaining([
        expect.objectContaining({ zhMeaning: '新釋義', sortOrder: 0 }),
      ]),
    );
    expect(result.data.meanings[0].zhMeaning).toBe('新釋義');
  });

  it('不能刪除其他牌組的卡片', async () => {
    const repository = store();
    repository.findCard.mockResolvedValue({ ...card(), deckId: 'other-deck' });
    await expect(
      new CardService(repository).delete('card-1', 'deck-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'CARD_NOT_FOUND',
      status: 404,
    });
    expect(repository.deleteCard).not.toHaveBeenCalled();
  });
});
