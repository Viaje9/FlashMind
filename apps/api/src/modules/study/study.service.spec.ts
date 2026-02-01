import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudyService } from './study.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FsrsService } from '../fsrs';
import { CardState, StudyRating as PrismaStudyRating } from '@prisma/client';
import { getStartOfStudyDay } from './study-day';

describe('StudyService', () => {
  let service: StudyService;
  let prisma: PrismaService;
  let fsrsService: FsrsService;

  const mockPrismaService = {
    deck: {
      findUnique: jest.fn(),
    },
    card: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    reviewLog: {
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockFsrsService = {
    calculateNextReview: jest.fn(),
    initializeCard: jest.fn(),
    isDue: jest.fn(),
    isNew: jest.fn(),
    parseLearningSteps: jest.fn((s: string) =>
      s.split(',').map((x: string) => x.trim()).filter((x: string) => x.length > 0),
    ),
  };

  const mockUserId = 'user-123';
  const mockDeckId = 'deck-123';
  const mockCardId = 'card-123';

  const mockDeck = {
    id: mockDeckId,
    name: '英文單字',
    userId: mockUserId,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    dailyResetHour: 4,
    learningSteps: '1m,10m',
    relearningSteps: '10m',
    requestRetention: 0.9,
    maximumInterval: 36500,
    enableReverse: false,
    overrideDate: null,
    overrideNewCards: null,
    overrideReviewCards: null,
    createdAt: new Date('2026-01-17T10:00:00Z'),
    updatedAt: new Date('2026-01-17T10:00:00Z'),
  };

  const mockMeaning = {
    id: 'meaning-123',
    cardId: mockCardId,
    zhMeaning: '你好',
    enExample: 'Hello, how are you?',
    zhExample: '你好，你好嗎？',
    sortOrder: 0,
  };

  const mockNewCard = {
    id: mockCardId,
    front: 'Hello',
    deckId: mockDeckId,
    state: CardState.NEW,
    due: null,
    stability: null,
    difficulty: null,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    learningStep: 0,
    reverseState: CardState.NEW,
    reverseDue: null,
    reverseStability: null,
    reverseDifficulty: null,
    reverseElapsedDays: 0,
    reverseScheduledDays: 0,
    reverseReps: 0,
    reverseLapses: 0,
    reverseLastReview: null,
    reverseLearningStep: 0,
    createdAt: new Date('2026-01-17T10:00:00Z'),
    updatedAt: new Date('2026-01-17T10:00:00Z'),
    meanings: [mockMeaning],
  };

  const mockDueCard = {
    id: 'card-due-123',
    front: 'World',
    deckId: mockDeckId,
    state: CardState.REVIEW,
    due: new Date('2026-01-18T10:00:00Z'),
    stability: 10,
    difficulty: 5,
    elapsedDays: 5,
    scheduledDays: 5,
    reps: 5,
    lapses: 0,
    lastReview: new Date('2026-01-13T10:00:00Z'),
    learningStep: 0,
    reverseState: CardState.NEW,
    reverseDue: null,
    reverseStability: null,
    reverseDifficulty: null,
    reverseElapsedDays: 0,
    reverseScheduledDays: 0,
    reverseReps: 0,
    reverseLapses: 0,
    reverseLastReview: null,
    reverseLearningStep: 0,
    createdAt: new Date('2026-01-10T10:00:00Z'),
    updatedAt: new Date('2026-01-18T10:00:00Z'),
    meanings: [{ ...mockMeaning, id: 'meaning-due-123', zhMeaning: '世界' }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FsrsService, useValue: mockFsrsService },
      ],
    }).compile();

    service = module.get<StudyService>(StudyService);
    prisma = module.get<PrismaService>(PrismaService);
    fsrsService = module.get<FsrsService>(FsrsService);

    jest.clearAllMocks();
  });

  describe('getStudyCards', () => {
    beforeEach(() => {
      // 預設今日已學數為 0
      mockPrismaService.reviewLog.count.mockResolvedValue(0);
    });

    it('應該回傳學習卡片（複習卡優先）', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0) // todayNewCardsStudied
        .mockResolvedValueOnce(0); // todayReviewCardsStudied
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockDueCard]) // due cards
        .mockResolvedValueOnce([mockNewCard]); // new cards

      const result = await service.getStudyCards(mockDeckId, mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('card-due-123'); // due card first
      expect(result[0].isNew).toBe(false);
      expect(result[1].id).toBe(mockCardId); // new card second
      expect(result[1].isNew).toBe(true);
    });

    it('學習卡片應包含 direction 欄位為 FORWARD', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([]) // no due cards
        .mockResolvedValueOnce([mockNewCard]); // new cards

      const result = await service.getStudyCards(mockDeckId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('FORWARD');
    });

    it('沒有卡片時應該回傳空陣列', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getStudyCards(mockDeckId, mockUserId);

      expect(result).toEqual([]);
    });

    it('已學新卡應從 dailyNewCards 扣除', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(10) // todayNewCardsStudied = 10
        .mockResolvedValueOnce(0); // todayReviewCardsStudied
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockDueCard]) // due cards
        .mockResolvedValueOnce([mockNewCard]); // new cards

      await service.getStudyCards(mockDeckId, mockUserId);

      // 新卡查詢的 take 應為 20 - 10 = 10
      const newCardsCall = mockPrismaService.card.findMany.mock.calls[1];
      expect(newCardsCall[0].take).toBe(10);
    });

    it('已複習卡應從 dailyReviewCards 扣除', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0) // todayNewCardsStudied
        .mockResolvedValueOnce(50); // todayReviewCardsStudied = 50
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockDueCard]) // due cards
        .mockResolvedValueOnce([mockNewCard]); // new cards

      await service.getStudyCards(mockDeckId, mockUserId);

      // 複習卡查詢的 take 應為 100 - 50 = 50
      const dueCardsCall = mockPrismaService.card.findMany.mock.calls[0];
      expect(dueCardsCall[0].take).toBe(50);
    });

    it('新卡額度用完時不查詢新卡', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(20) // todayNewCardsStudied = 20（已用完）
        .mockResolvedValueOnce(0);
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockDueCard]); // 只有 due cards 查詢

      const result = await service.getStudyCards(mockDeckId, mockUserId);

      // 應只呼叫一次 findMany（只查複習卡）
      expect(mockPrismaService.card.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-due-123');
    });

    it('複習卡額度用完時不查詢複習卡', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(100); // todayReviewCardsStudied = 100（已用完）
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockNewCard]); // 只有 new cards 查詢

      const result = await service.getStudyCards(mockDeckId, mockUserId);

      // 應只呼叫一次 findMany（只查新卡）
      expect(mockPrismaService.card.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockCardId);
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.getStudyCards('nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.getStudyCards(mockDeckId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enableReverse 為 true 時應回傳正向和反向 StudyCard', async () => {
      const reverseDeck = { ...mockDeck, enableReverse: true };
      mockPrismaService.deck.findUnique.mockResolvedValue(reverseDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0) // todayNewCardsStudied
        .mockResolvedValueOnce(0); // todayReviewCardsStudied

      const reverseNewCard = {
        ...mockNewCard,
        id: 'card-reverse-new',
        reverseState: CardState.NEW,
      };

      const reverseDueCard = {
        ...mockDueCard,
        id: 'card-reverse-due',
        reverseState: CardState.REVIEW,
        reverseDue: new Date('2026-01-18T09:00:00Z'),
      };

      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockDueCard]) // 正向複習卡
        .mockResolvedValueOnce([mockNewCard]) // 正向新卡
        .mockResolvedValueOnce([reverseDueCard]) // 反向複習卡
        .mockResolvedValueOnce([reverseNewCard]); // 反向新卡

      const result = await service.getStudyCards(mockDeckId, mockUserId);

      // 4 張卡：正向複習 + 反向複習 + 正向新卡 + 反向新卡
      expect(result).toHaveLength(4);
      expect(result[0].direction).toBe('FORWARD');
      expect(result[0].isNew).toBe(false);
      expect(result[1].direction).toBe('REVERSE');
      expect(result[1].isNew).toBe(false);
      expect(result[1].state).toBe(CardState.REVIEW);
      expect(result[2].direction).toBe('FORWARD');
      expect(result[2].isNew).toBe(true);
      expect(result[3].direction).toBe('REVERSE');
      expect(result[3].isNew).toBe(true);
    });

    it('enableReverse 為 false 時不查詢反向卡片', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck); // enableReverse: false
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockDueCard]) // 正向複習卡
        .mockResolvedValueOnce([mockNewCard]); // 正向新卡

      const result = await service.getStudyCards(mockDeckId, mockUserId);

      // 只有 2 次 findMany 呼叫（正向複習 + 正向新卡）
      expect(mockPrismaService.card.findMany).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result.every((c) => c.direction === 'FORWARD')).toBe(true);
    });

    it('覆寫有效時應使用覆寫上限計算剩餘額度', async () => {
      const now = new Date('2026-01-20T10:00:00');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const overrideDate = getStartOfStudyDay(now, 4);
      const overrideDeck = {
        ...mockDeck,
        overrideDate,
        overrideNewCards: 50,
        overrideReviewCards: 200,
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(overrideDeck);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(10) // todayNewCardsStudied = 10
        .mockResolvedValueOnce(50); // todayReviewCardsStudied = 50
      mockPrismaService.card.findMany
        .mockResolvedValueOnce([mockDueCard]) // due cards
        .mockResolvedValueOnce([mockNewCard]); // new cards

      await service.getStudyCards(mockDeckId, mockUserId);

      // 複習卡 take = 200 - 50 = 150
      const dueCardsCall = mockPrismaService.card.findMany.mock.calls[0];
      expect(dueCardsCall[0].take).toBe(150);
      // 新卡 take = 50 - 10 = 40
      const newCardsCall = mockPrismaService.card.findMany.mock.calls[1];
      expect(newCardsCall[0].take).toBe(40);

      jest.useRealTimers();
    });
  });

  describe('submitReview', () => {
    const now = new Date('2026-01-19T10:00:00Z');
    const nextDue = new Date('2026-01-20T10:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);

      mockFsrsService.calculateNextReview.mockReturnValue({
        card: {
          state: 'LEARNING',
          due: nextDue,
          stability: 1.5,
          difficulty: 5.5,
          elapsedDays: 0,
          scheduledDays: 1,
          reps: 1,
          lapses: 0,
          lastReview: now,
          learningStep: 1,
        },
        log: {
          rating: 'known',
          state: 'NEW',
          due: now,
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 1,
          review: now,
        },
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('應該更新卡片排程並建立 ReviewLog', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockNewCard);
      mockPrismaService.card.update.mockResolvedValue({
        ...mockNewCard,
        state: CardState.LEARNING,
        due: nextDue,
      });
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      const result = await service.submitReview(
        mockDeckId,
        mockCardId,
        'known',
        mockUserId,
      );

      expect(fsrsService.calculateNextReview).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'NEW' }),
        'known',
        now,
        { requestRetention: 0.9, maximumInterval: 36500, learningSteps: ['1m', '10m'], relearningSteps: ['10m'] },
      );
      expect(prisma.card.update).toHaveBeenCalledWith({
        where: { id: mockCardId },
        data: expect.objectContaining({
          state: CardState.LEARNING,
          due: nextDue,
          reps: 1,
        }),
      });
      expect(prisma.reviewLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cardId: mockCardId,
          rating: PrismaStudyRating.KNOWN,
          prevState: CardState.NEW,
          newState: CardState.LEARNING,
          direction: 'FORWARD',
        }),
      });
      expect(result.cardId).toBe(mockCardId);
      expect(result.rating).toBe('known');
      expect(result.newState).toBe(CardState.LEARNING);
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.submitReview('nonexistent', mockCardId, 'known', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('卡片不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(null);

      await expect(
        service.submitReview(mockDeckId, 'nonexistent', 'known', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.submitReview(mockDeckId, mockCardId, 'known', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('應該將牌組的 FSRS 參數傳遞給 FsrsService', async () => {
      const customDeck = {
        ...mockDeck,
        requestRetention: 0.85,
        maximumInterval: 180,
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(customDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockNewCard);
      mockPrismaService.card.update.mockResolvedValue(mockNewCard);
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      await service.submitReview(mockDeckId, mockCardId, 'known', mockUserId);

      expect(fsrsService.calculateNextReview).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'NEW' }),
        'known',
        now,
        { requestRetention: 0.85, maximumInterval: 180, learningSteps: ['1m', '10m'], relearningSteps: ['10m'] },
      );
    });

    it('submitReview 帶 direction=REVERSE 時應更新 reverseState 等欄位', async () => {
      const reverseDeck = { ...mockDeck, enableReverse: true };
      mockPrismaService.deck.findUnique.mockResolvedValue(reverseDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockNewCard);
      mockPrismaService.card.update.mockResolvedValue({
        ...mockNewCard,
        reverseState: CardState.LEARNING,
        reverseDue: nextDue,
      });
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      const result = await service.submitReview(
        mockDeckId,
        mockCardId,
        'known',
        mockUserId,
        'REVERSE',
      );

      // 應使用 reverse 欄位建立 currentState
      expect(fsrsService.calculateNextReview).toHaveBeenCalledWith(
        expect.objectContaining({
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
        }),
        'known',
        now,
        { requestRetention: 0.9, maximumInterval: 36500, learningSteps: ['1m', '10m'], relearningSteps: ['10m'] },
      );

      // 應更新 reverse 欄位
      expect(prisma.card.update).toHaveBeenCalledWith({
        where: { id: mockCardId },
        data: {
          reverseState: CardState.LEARNING,
          reverseDue: nextDue,
          reverseStability: 1.5,
          reverseDifficulty: 5.5,
          reverseElapsedDays: 0,
          reverseScheduledDays: 1,
          reverseReps: 1,
          reverseLapses: 0,
          reverseLastReview: now,
          reverseLearningStep: 1,
        },
      });

      // ReviewLog 應記錄 direction=REVERSE 且 prevState 為 reverseState
      expect(prisma.reviewLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cardId: mockCardId,
          direction: 'REVERSE',
          prevState: CardState.NEW, // mockNewCard.reverseState
          prevStability: null, // mockNewCard.reverseStability
          prevDifficulty: null, // mockNewCard.reverseDifficulty
          newState: CardState.LEARNING,
        }),
      });

      expect(result.cardId).toBe(mockCardId);
      expect(result.newState).toBe(CardState.LEARNING);
    });

    it('應將牌組的 learningSteps 和 relearningSteps 解析後傳遞給 FsrsService', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockNewCard);
      mockPrismaService.card.update.mockResolvedValue(mockNewCard);
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      await service.submitReview(mockDeckId, mockCardId, 'known', mockUserId);

      expect(fsrsService.calculateNextReview).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'NEW', learningStep: 0 }),
        'known',
        now,
        {
          requestRetention: 0.9,
          maximumInterval: 36500,
          learningSteps: ['1m', '10m'],
          relearningSteps: ['10m'],
        },
      );
    });

    it('card update data 應包含 learningStep（正向）', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockNewCard);
      mockPrismaService.card.update.mockResolvedValue(mockNewCard);
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      await service.submitReview(mockDeckId, mockCardId, 'known', mockUserId);

      expect(prisma.card.update).toHaveBeenCalledWith({
        where: { id: mockCardId },
        data: expect.objectContaining({
          learningStep: 1,
        }),
      });
    });

    it('card update data 應包含 reverseLearningStep（反向）', async () => {
      const reverseDeck = { ...mockDeck, enableReverse: true };
      mockPrismaService.deck.findUnique.mockResolvedValue(reverseDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockNewCard);
      mockPrismaService.card.update.mockResolvedValue(mockNewCard);
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      await service.submitReview(mockDeckId, mockCardId, 'known', mockUserId, 'REVERSE');

      expect(prisma.card.update).toHaveBeenCalledWith({
        where: { id: mockCardId },
        data: expect.objectContaining({
          reverseLearningStep: 1,
        }),
      });
    });

    it('currentState 應包含正確的 learningStep（正向）', async () => {
      const learningCard = {
        ...mockNewCard,
        state: CardState.LEARNING,
        learningStep: 1,
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(learningCard);
      mockPrismaService.card.update.mockResolvedValue(learningCard);
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      await service.submitReview(mockDeckId, mockCardId, 'known', mockUserId);

      expect(fsrsService.calculateNextReview).toHaveBeenCalledWith(
        expect.objectContaining({ learningStep: 1 }),
        'known',
        now,
        expect.any(Object),
      );
    });

    it('currentState 應包含正確的 reverseLearningStep（反向）', async () => {
      const reverseCard = {
        ...mockNewCard,
        reverseState: CardState.LEARNING,
        reverseLearningStep: 2,
      };
      const reverseDeck = { ...mockDeck, enableReverse: true };
      mockPrismaService.deck.findUnique.mockResolvedValue(reverseDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(reverseCard);
      mockPrismaService.card.update.mockResolvedValue(reverseCard);
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      await service.submitReview(mockDeckId, mockCardId, 'known', mockUserId, 'REVERSE');

      expect(fsrsService.calculateNextReview).toHaveBeenCalledWith(
        expect.objectContaining({ learningStep: 2 }),
        'known',
        now,
        expect.any(Object),
      );
    });

    it('submitReview 預設 direction 為 FORWARD', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockNewCard);
      mockPrismaService.card.update.mockResolvedValue(mockNewCard);
      mockPrismaService.reviewLog.create.mockResolvedValue({});

      await service.submitReview(mockDeckId, mockCardId, 'known', mockUserId);

      // 應更新正向欄位（state, due 等）
      expect(prisma.card.update).toHaveBeenCalledWith({
        where: { id: mockCardId },
        data: expect.objectContaining({
          state: CardState.LEARNING,
        }),
      });

      // 不應包含 reverse 欄位
      const updateCall = mockPrismaService.card.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('reverseState');

      // ReviewLog 應記錄 direction=FORWARD
      expect(prisma.reviewLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'FORWARD',
        }),
      });
    });
  });

  describe('getSummary', () => {
    it('應該回傳學習統計摘要（含每日限額與今日已學細項）', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(100) // totalCards
        .mockResolvedValueOnce(30) // forwardNewCount
        .mockResolvedValueOnce(15); // forwardReviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(10) // todayStudied
        .mockResolvedValueOnce(5)  // todayNewStudied
        .mockResolvedValueOnce(5); // todayReviewStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result).toEqual({
        totalCards: 100,
        newCount: 30,
        reviewCount: 15,
        todayStudied: 10,
        dailyNewCards: 20,
        dailyReviewCards: 100,
        todayNewStudied: 5,
        todayReviewStudied: 5,
      });
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.getSummary('nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.getSummary(mockDeckId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getSummary 應在 enableReverse 時包含反向統計', async () => {
      const reverseDeck = { ...mockDeck, enableReverse: true };
      mockPrismaService.deck.findUnique.mockResolvedValue(reverseDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(100) // totalCards
        .mockResolvedValueOnce(30) // forwardNewCount
        .mockResolvedValueOnce(15) // forwardReviewCount
        .mockResolvedValueOnce(20) // reverseNewCount
        .mockResolvedValueOnce(8); // reverseReviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(10) // todayStudied
        .mockResolvedValueOnce(5)  // todayNewStudied
        .mockResolvedValueOnce(5); // todayReviewStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result).toEqual({
        totalCards: 100,
        newCount: 50, // 30 + 20
        reviewCount: 23, // 15 + 8
        todayStudied: 10,
        dailyNewCards: 20,
        dailyReviewCards: 100,
        todayNewStudied: 5,
        todayReviewStudied: 5,
      });
    });

    it('getSummary 在 enableReverse 為 false 時不查詢反向統計', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck); // enableReverse: false
      mockPrismaService.card.count
        .mockResolvedValueOnce(100) // totalCards
        .mockResolvedValueOnce(30) // forwardNewCount
        .mockResolvedValueOnce(15); // forwardReviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(10) // todayStudied
        .mockResolvedValueOnce(3)  // todayNewStudied
        .mockResolvedValueOnce(7); // todayReviewStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      // 只呼叫 3 次 card.count（totalCards + forwardNewCount + forwardReviewCount）
      expect(mockPrismaService.card.count).toHaveBeenCalledTimes(3);
      expect(result.newCount).toBe(30);
      expect(result.reviewCount).toBe(15);
      expect(result.dailyNewCards).toBe(20);
      expect(result.dailyReviewCards).toBe(100);
      expect(result.todayNewStudied).toBe(3);
      expect(result.todayReviewStudied).toBe(7);
    });

    it('todayNewStudied 應計算 prevState=NEW 的 ReviewLog 數量', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(50) // totalCards
        .mockResolvedValueOnce(10) // forwardNewCount
        .mockResolvedValueOnce(5); // forwardReviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(12) // todayStudied
        .mockResolvedValueOnce(8)  // todayNewStudied
        .mockResolvedValueOnce(4); // todayReviewStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result.todayNewStudied).toBe(8);
      // 驗證第二次 reviewLog.count 呼叫使用 prevState: NEW
      expect(mockPrismaService.reviewLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            prevState: CardState.NEW,
          }),
        }),
      );
    });

    it('todayReviewStudied 應計算 prevState!=NEW 的 ReviewLog 數量', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(50) // totalCards
        .mockResolvedValueOnce(10) // forwardNewCount
        .mockResolvedValueOnce(5); // forwardReviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(12) // todayStudied
        .mockResolvedValueOnce(8)  // todayNewStudied
        .mockResolvedValueOnce(4); // todayReviewStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result.todayReviewStudied).toBe(4);
      // 驗證第三次 reviewLog.count 呼叫使用 prevState: { not: NEW }
      expect(mockPrismaService.reviewLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            prevState: { not: CardState.NEW },
          }),
        }),
      );
    });

    it('dailyNewCards 和 dailyReviewCards 應來自牌組設定', async () => {
      const customDeck = { ...mockDeck, dailyNewCards: 15, dailyReviewCards: 200 };
      mockPrismaService.deck.findUnique.mockResolvedValue(customDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(50) // totalCards
        .mockResolvedValueOnce(10) // forwardNewCount
        .mockResolvedValueOnce(5); // forwardReviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0)  // todayStudied
        .mockResolvedValueOnce(0)  // todayNewStudied
        .mockResolvedValueOnce(0); // todayReviewStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result.dailyNewCards).toBe(15);
      expect(result.dailyReviewCards).toBe(200);
    });

    it('啟用反向學習時 todayNewStudied 應包含正向與反向的新卡學習次數', async () => {
      const reverseDeck = { ...mockDeck, enableReverse: true };
      mockPrismaService.deck.findUnique.mockResolvedValue(reverseDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(50)  // totalCards
        .mockResolvedValueOnce(10)  // forwardNewCount
        .mockResolvedValueOnce(5)   // forwardReviewCount
        .mockResolvedValueOnce(10)  // reverseNewCount
        .mockResolvedValueOnce(3);  // reverseReviewCount
      // todayNewStudied 和 todayReviewStudied 查詢是按 card.deckId 過濾，
      // 已包含正向和反向（因為是根據 ReviewLog.prevState 判斷）
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(15)  // todayStudied（含正向與反向）
        .mockResolvedValueOnce(10)  // todayNewStudied（含正向與反向 NEW）
        .mockResolvedValueOnce(5);  // todayReviewStudied（含正向與反向非 NEW）

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result.todayNewStudied).toBe(10);
      expect(result.todayReviewStudied).toBe(5);
    });

    it('覆寫有效時 dailyNewCards 和 dailyReviewCards 應回傳有效上限', async () => {
      const now = new Date('2026-01-20T10:00:00');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const overrideDate = getStartOfStudyDay(now, 4);
      const overrideDeck = {
        ...mockDeck,
        overrideDate,
        overrideNewCards: 50,
        overrideReviewCards: 200,
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(overrideDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(15);
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result.dailyNewCards).toBe(50);
      expect(result.dailyReviewCards).toBe(200);

      jest.useRealTimers();
    });

    it('尚未學習時 todayNewStudied 和 todayReviewStudied 應為 0', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(50) // totalCards
        .mockResolvedValueOnce(20) // forwardNewCount
        .mockResolvedValueOnce(10); // forwardReviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(0)  // todayStudied
        .mockResolvedValueOnce(0)  // todayNewStudied
        .mockResolvedValueOnce(0); // todayReviewStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result.todayNewStudied).toBe(0);
      expect(result.todayReviewStudied).toBe(0);
      expect(result.todayStudied).toBe(0);
    });
  });
});
