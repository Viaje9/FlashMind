import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DeckService } from './deck.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getStartOfStudyDay } from '../study/study-day';

describe('DeckService', () => {
  let service: DeckService;
  let prisma: PrismaService;

  const mockPrismaService = {
    deck: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    card: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn(),
    },
    reviewLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const mockUserId = 'user-123';
  const mockTimezone = 'Asia/Taipei';
  const mockDeck = {
    id: 'deck-123',
    name: '英文單字',
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
    userId: mockUserId,
    createdAt: new Date('2026-01-17T10:00:00Z'),
    updatedAt: new Date('2026-01-17T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeckService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DeckService>(DeckService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAllByUserId', () => {
    it('應該回傳使用者的所有牌組', async () => {
      mockPrismaService.deck.findMany.mockResolvedValue([mockDeck]);

      const result = await service.findAllByUserId(mockUserId, mockTimezone);

      expect(prisma.deck.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'deck-123',
        name: '英文單字',
        newCount: 0,
        reviewCount: 0,
        totalCount: 0,
        completedCount: 0,
        progress: 0,
        enableReverse: false,
        dailyNewCards: 20,
        dailyReviewCards: 100,
        todayNewStudied: 0,
        todayReviewStudied: 0,
      });
    });

    it('使用者沒有牌組時應該回傳空陣列', async () => {
      mockPrismaService.deck.findMany.mockResolvedValue([]);

      const result = await service.findAllByUserId(mockUserId, mockTimezone);

      expect(result).toEqual([]);
    });

    it('應回傳今日學習進度', async () => {
      mockPrismaService.deck.findMany.mockResolvedValue([mockDeck]);
      mockPrismaService.card.count
        .mockResolvedValueOnce(50) // totalCount
        .mockResolvedValueOnce(20) // newCount
        .mockResolvedValueOnce(10); // reviewCount
      mockPrismaService.reviewLog.count
        .mockResolvedValueOnce(5) // todayNewStudied
        .mockResolvedValueOnce(8); // todayReviewStudied

      const result = await service.findAllByUserId(mockUserId, mockTimezone);

      expect(result[0]).toEqual(
        expect.objectContaining({
          dailyNewCards: 20,
          dailyReviewCards: 100,
          todayNewStudied: 5,
          todayReviewStudied: 8,
        }),
      );
      expect(mockPrismaService.reviewLog.count).toHaveBeenCalledTimes(2);
    });

    it('enableReverse 為 true 時統計應包含反向卡片', async () => {
      const reverseDeck = { ...mockDeck, enableReverse: true };
      mockPrismaService.deck.findMany.mockResolvedValue([reverseDeck]);
      mockPrismaService.card.count
        .mockResolvedValueOnce(10) // totalCount
        .mockResolvedValueOnce(3) // newCount (forward)
        .mockResolvedValueOnce(2) // reviewCount (forward)
        .mockResolvedValueOnce(4) // reverseNewCount
        .mockResolvedValueOnce(1); // reverseReviewCount

      const result = await service.findAllByUserId(mockUserId, mockTimezone);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'deck-123',
        name: '英文單字',
        newCount: 7, // 3 + 4
        reviewCount: 3, // 2 + 1
        totalCount: 10, // 不變
        completedCount: 7, // 10 - 3
        progress: 70, // (7/10) * 100
        enableReverse: true,
        dailyNewCards: 20,
        dailyReviewCards: 100,
        todayNewStudied: 0,
        todayReviewStudied: 0,
      });
    });
  });

  describe('findById', () => {
    it('應該回傳牌組詳情', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      const result = await service.findById('deck-123', mockUserId);

      expect(prisma.deck.findUnique).toHaveBeenCalledWith({
        where: { id: 'deck-123' },
      });
      expect(result).toEqual({
        id: 'deck-123',
        name: '英文單字',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        dailyResetHour: 4,
        learningSteps: '1m,10m',
        relearningSteps: '10m',
        requestRetention: 0.9,
        maximumInterval: 36500,
        enableReverse: false,
        stats: {
          newCount: 0,
          reviewCount: 0,
          totalCount: 0,
          createdAt: '2026-01-17T10:00:00.000Z',
          lastStudiedAt: null,
        },
      });
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(service.findById('deck-123', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('exportDeck', () => {
    it('只應匯出牌組設定與依序排列的卡片內容', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findMany.mockResolvedValue([
        {
          front: 'Where are they?',
          note: '提醒：they 是複數代名詞',
          meanings: [
            {
              zhMeaning: '他們在哪裡？',
              enExample: 'Where are they now?',
              zhExample: '他們現在在哪裡？',
              sortOrder: 0,
            },
          ],
        },
      ]);

      const result = await service.exportDeck('deck-123', mockUserId);

      expect(prisma.card.findMany).toHaveBeenCalledWith({
        where: { deckId: 'deck-123' },
        orderBy: { createdAt: 'asc' },
        select: {
          front: true,
          note: true,
          meanings: {
            orderBy: { sortOrder: 'asc' },
            select: {
              zhMeaning: true,
              enExample: true,
              zhExample: true,
              sortOrder: true,
            },
          },
        },
      });
      expect(result).toEqual({
        data: {
          version: 1,
          name: '英文單字',
          dailyNewCards: 20,
          dailyReviewCards: 100,
          dailyResetHour: 4,
          learningSteps: '1m,10m',
          relearningSteps: '10m',
          requestRetention: 0.9,
          maximumInterval: 36500,
          enableReverse: false,
          cards: [
            {
              front: 'Where are they?',
              note: '提醒：they 是複數代名詞',
              meanings: [
                {
                  zhMeaning: '他們在哪裡？',
                  enExample: 'Where are they now?',
                  zhExample: '他們現在在哪裡？',
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      });
    });

    it('使用者無權限時不應讀取卡片', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.exportDeck('deck-123', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.card.findMany).not.toHaveBeenCalled();
    });
  });

  describe('importDeck', () => {
    it('應建立不含學習狀態的新牌組與卡片', async () => {
      mockPrismaService.deck.findMany.mockResolvedValue([{ name: '英文單字' }]);
      mockPrismaService.deck.create.mockResolvedValue({ id: 'imported-deck' });

      const result = await service.importDeck(mockUserId, {
        version: 1,
        name: '英文單字',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        dailyResetHour: 4,
        learningSteps: '1m,10m',
        relearningSteps: '10m',
        requestRetention: 0.9,
        maximumInterval: 36500,
        enableReverse: false,
        cards: [
          {
            front: 'Hello',
            note: '比 hi 稍微正式',
            meanings: [
              {
                zhMeaning: '你好',
                enExample: null,
                zhExample: null,
                sortOrder: 0,
              },
            ],
          },
        ],
      });

      expect(prisma.deck.create).toHaveBeenCalledWith({
        data: {
          name: '英文單字（匯入）',
          dailyNewCards: 20,
          dailyReviewCards: 100,
          dailyResetHour: 4,
          learningSteps: '1m,10m',
          relearningSteps: '10m',
          requestRetention: 0.9,
          maximumInterval: 36500,
          enableReverse: false,
          userId: mockUserId,
          cards: {
            create: [
              {
                front: 'Hello',
                note: '比 hi 稍微正式',
                meanings: {
                  create: [
                    {
                      zhMeaning: '你好',
                      enExample: null,
                      zhExample: null,
                      sortOrder: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
      });
      expect(result).toEqual({
        data: { id: 'imported-deck', name: '英文單字（匯入）' },
      });
    });

    it('匯入舊版不含 note 的卡片時應將備註設為 null', async () => {
      mockPrismaService.deck.findMany.mockResolvedValue([]);
      mockPrismaService.deck.create.mockResolvedValue({ id: 'imported-deck' });

      await service.importDeck(mockUserId, {
        version: 1,
        name: '舊版牌組',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        dailyResetHour: 4,
        learningSteps: '1m,10m',
        relearningSteps: '10m',
        requestRetention: 0.9,
        maximumInterval: 36500,
        enableReverse: false,
        cards: [
          {
            front: 'Legacy',
            meanings: [
              {
                zhMeaning: '舊版',
                enExample: null,
                zhExample: null,
                sortOrder: 0,
              },
            ],
          },
        ],
      });

      expect(prisma.deck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cards: {
              create: [
                expect.objectContaining({ front: 'Legacy', note: null }),
              ],
            },
          }),
        }),
      );
    });

    it('應遞增匯入後綴直到名稱不衝突', async () => {
      mockPrismaService.deck.findMany.mockResolvedValue([
        { name: '英文單字' },
        { name: '英文單字（匯入）' },
        { name: '英文單字（匯入 2）' },
      ]);
      mockPrismaService.deck.create.mockResolvedValue({ id: 'imported-deck' });

      const dto = {
        version: 1 as const,
        name: '英文單字',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        dailyResetHour: 4,
        learningSteps: '1m,10m',
        relearningSteps: '10m',
        requestRetention: 0.9,
        maximumInterval: 36500,
        enableReverse: false,
        cards: [],
      };

      await service.importDeck(mockUserId, dto);

      expect(prisma.deck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: '英文單字（匯入 3）' }),
        }),
      );
    });
  });

  describe('create', () => {
    it('應該建立新牌組並使用預設值', async () => {
      mockPrismaService.deck.create.mockResolvedValue(mockDeck);

      const result = await service.create(mockUserId, { name: '英文單字' });

      expect(prisma.deck.create).toHaveBeenCalledWith({
        data: {
          name: '英文單字',
          dailyNewCards: 20,
          dailyReviewCards: 100,
          dailyResetHour: 4,
          learningSteps: '1m,10m',
          relearningSteps: '10m',
          requestRetention: 0.9,
          maximumInterval: 36500,
          enableReverse: false,
          userId: mockUserId,
        },
      });
      expect(result.data).toEqual({
        id: 'deck-123',
        name: '英文單字',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        dailyResetHour: 4,
        learningSteps: '1m,10m',
        relearningSteps: '10m',
        requestRetention: 0.9,
        maximumInterval: 36500,
        enableReverse: false,
        createdAt: '2026-01-17T10:00:00.000Z',
        updatedAt: '2026-01-17T10:00:00.000Z',
      });
    });

    it('應該使用自訂的每日學習數', async () => {
      const customDeck = {
        ...mockDeck,
        dailyNewCards: 30,
        dailyReviewCards: 150,
      };
      mockPrismaService.deck.create.mockResolvedValue(customDeck);

      await service.create(mockUserId, {
        name: '英文單字',
        dailyNewCards: 30,
        dailyReviewCards: 150,
      });

      expect(prisma.deck.create).toHaveBeenCalledWith({
        data: {
          name: '英文單字',
          dailyNewCards: 30,
          dailyReviewCards: 150,
          dailyResetHour: 4,
          learningSteps: '1m,10m',
          relearningSteps: '10m',
          requestRetention: 0.9,
          maximumInterval: 36500,
          enableReverse: false,
          userId: mockUserId,
        },
      });
    });

    it('應該使用自訂的 FSRS 參數建立牌組', async () => {
      const customDeck = {
        ...mockDeck,
        learningSteps: '1m,5m,10m',
        relearningSteps: '5m',
        requestRetention: 0.85,
        maximumInterval: 180,
      };
      mockPrismaService.deck.create.mockResolvedValue(customDeck);

      await service.create(mockUserId, {
        name: '英文單字',
        learningSteps: '1m,5m,10m',
        relearningSteps: '5m',
        requestRetention: 0.85,
        maximumInterval: 180,
      });

      expect(prisma.deck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          learningSteps: '1m,5m,10m',
          relearningSteps: '5m',
          requestRetention: 0.85,
          maximumInterval: 180,
        }),
      });
    });
  });

  describe('update', () => {
    it('應該更新牌組名稱', async () => {
      const updatedDeck = { ...mockDeck, name: '新名稱' };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.deck.update.mockResolvedValue(updatedDeck);

      const result = await service.update('deck-123', mockUserId, {
        name: '新名稱',
      });

      expect(prisma.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-123' },
        data: { name: '新名稱' },
      });
      expect(result.data.name).toBe('新名稱');
    });

    it('應該更新每日學習數', async () => {
      const updatedDeck = { ...mockDeck, dailyNewCards: 50 };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.deck.update.mockResolvedValue(updatedDeck);

      const result = await service.update('deck-123', mockUserId, {
        dailyNewCards: 50,
      });

      expect(prisma.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-123' },
        data: { dailyNewCards: 50 },
      });
      expect(result.data.dailyNewCards).toBe(50);
    });

    it('應該更新 FSRS 參數', async () => {
      const updatedDeck = {
        ...mockDeck,
        requestRetention: 0.85,
        maximumInterval: 180,
        learningSteps: '1m,5m,10m',
        relearningSteps: '5m',
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.deck.update.mockResolvedValue(updatedDeck);

      const result = await service.update('deck-123', mockUserId, {
        requestRetention: 0.85,
        maximumInterval: 180,
        learningSteps: '1m,5m,10m',
        relearningSteps: '5m',
      });

      expect(prisma.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-123' },
        data: {
          requestRetention: 0.85,
          maximumInterval: 180,
          learningSteps: '1m,5m,10m',
          relearningSteps: '5m',
        },
      });
      expect(result.data.requestRetention).toBe(0.85);
      expect(result.data.maximumInterval).toBe(180);
      expect(result.data.learningSteps).toBe('1m,5m,10m');
      expect(result.data.relearningSteps).toBe('5m');
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', mockUserId, { name: '新名稱' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.update('deck-123', 'other-user', { name: '新名稱' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('應該刪除牌組', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.deck.delete.mockResolvedValue(mockDeck);

      await service.delete('deck-123', mockUserId);

      expect(prisma.deck.delete).toHaveBeenCalledWith({
        where: { id: 'deck-123' },
      });
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(service.delete('deck-123', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('setDailyOverride', () => {
    it('應該成功設定覆寫', async () => {
      const now = new Date('2026-01-20T10:00:00');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const overrideDate = getStartOfStudyDay(now, 4, mockTimezone);
      const updatedDeck = {
        ...mockDeck,
        overrideDate,
        overrideNewCards: 50,
        overrideReviewCards: 200,
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.deck.update.mockResolvedValue(updatedDeck);

      const result = await service.setDailyOverride(
        'deck-123',
        mockUserId,
        {
          newCards: 50,
          reviewCards: 200,
        },
        mockTimezone,
      );

      expect(result.data.effectiveNewCards).toBe(50);
      expect(result.data.effectiveReviewCards).toBe(200);
      expect(prisma.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-123' },
        data: expect.objectContaining({
          overrideNewCards: 50,
          overrideReviewCards: 200,
        }),
      });

      jest.useRealTimers();
    });

    it('覆寫值低於預設值時應拋出 UnprocessableEntityException（新卡）', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.setDailyOverride(
          'deck-123',
          mockUserId,
          { newCards: 5 },
          mockTimezone,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('覆寫值低於預設值時應拋出 UnprocessableEntityException（複習卡）', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.setDailyOverride(
          'deck-123',
          mockUserId,
          { reviewCards: 50 },
          mockTimezone,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('未授權存取應拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.setDailyOverride(
          'deck-123',
          'other-user',
          { newCards: 50 },
          mockTimezone,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('牌組不存在時應拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.setDailyOverride(
          'nonexistent',
          mockUserId,
          { newCards: 50 },
          mockTimezone,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('重複設定覆寫應取代前次', async () => {
      const now = new Date('2026-01-20T10:00:00');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const overrideDate = getStartOfStudyDay(now, 4, mockTimezone);
      const firstUpdate = {
        ...mockDeck,
        overrideDate,
        overrideNewCards: 50,
        overrideReviewCards: null,
      };
      const secondUpdate = {
        ...mockDeck,
        overrideDate,
        overrideNewCards: 80,
        overrideReviewCards: null,
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.deck.update
        .mockResolvedValueOnce(firstUpdate)
        .mockResolvedValueOnce(secondUpdate);

      await service.setDailyOverride(
        'deck-123',
        mockUserId,
        { newCards: 50 },
        mockTimezone,
      );
      const result = await service.setDailyOverride(
        'deck-123',
        mockUserId,
        { newCards: 80 },
        mockTimezone,
      );

      expect(result.data.effectiveNewCards).toBe(80);

      jest.useRealTimers();
    });
  });
});
