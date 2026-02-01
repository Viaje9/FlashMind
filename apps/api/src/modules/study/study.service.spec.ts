import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudyService } from './study.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FsrsService } from '../fsrs';
import { CardState, StudyRating as PrismaStudyRating } from '@prisma/client';

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
  });

  describe('getSummary', () => {
    it('應該回傳學習統計摘要', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.count
        .mockResolvedValueOnce(100) // totalCards
        .mockResolvedValueOnce(30) // newCount
        .mockResolvedValueOnce(15); // reviewCount
      mockPrismaService.reviewLog.count.mockResolvedValue(10); // todayStudied

      const result = await service.getSummary(mockDeckId, mockUserId);

      expect(result).toEqual({
        totalCards: 100,
        newCount: 30,
        reviewCount: 15,
        todayStudied: 10,
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
  });
});
