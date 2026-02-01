import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CardService } from './card.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CardService', () => {
  let service: CardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    deck: {
      findUnique: jest.fn(),
    },
    card: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createManyAndReturn: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cardMeaning: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
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
    createdAt: new Date('2026-01-17T10:00:00Z'),
    updatedAt: new Date('2026-01-17T10:00:00Z'),
  };

  const mockCard = {
    id: mockCardId,
    front: 'Hello',
    deckId: mockDeckId,
    state: 'NEW',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CardService>(CardService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAllByDeckId', () => {
    it('應該回傳牌組內的所有卡片列表', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findMany.mockResolvedValue([mockCard]);

      const result = await service.findAllByDeckId(mockDeckId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockCardId,
        front: 'Hello',
        summary: '你好',
        state: 'NEW',
        due: null,
      });
    });

    it('牌組內沒有卡片時應該回傳空陣列', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findMany.mockResolvedValue([]);

      const result = await service.findAllByDeckId(mockDeckId, mockUserId);

      expect(result).toEqual([]);
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllByDeckId('nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.findAllByDeckId(mockDeckId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findById', () => {
    it('應該回傳卡片詳情', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockCard);

      const result = await service.findById(mockCardId, mockDeckId, mockUserId);

      expect(result).toEqual({
        id: mockCardId,
        front: 'Hello',
        meanings: [
          {
            id: 'meaning-123',
            zhMeaning: '你好',
            enExample: 'Hello, how are you?',
            zhExample: '你好，你好嗎？',
          },
        ],
        createdAt: '2026-01-17T10:00:00.000Z',
        updatedAt: '2026-01-17T10:00:00.000Z',
      });
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.findById(mockCardId, 'nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('卡片不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent', mockDeckId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('卡片不屬於該牌組時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue({
        ...mockCard,
        deckId: 'other-deck',
      });

      await expect(
        service.findById(mockCardId, mockDeckId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.findById(mockCardId, mockDeckId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    const createDto = {
      front: 'Hello',
      meanings: [
        {
          zhMeaning: '你好',
          enExample: 'Hello, how are you?',
          zhExample: '你好，你好嗎？',
        },
      ],
    };

    it('應該建立新卡片', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.create.mockResolvedValue(mockCard);

      const result = await service.create(mockDeckId, mockUserId, createDto);

      expect(result.data).toEqual({
        id: mockCardId,
        front: 'Hello',
        meanings: [
          {
            id: 'meaning-123',
            zhMeaning: '你好',
            enExample: 'Hello, how are you?',
            zhExample: '你好，你好嗎？',
          },
        ],
        createdAt: '2026-01-17T10:00:00.000Z',
        updatedAt: '2026-01-17T10:00:00.000Z',
      });

      expect(mockPrismaService.card.create).toHaveBeenCalledTimes(1);
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.create('nonexistent', mockUserId, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.create(mockDeckId, 'other-user', createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const updateDto = {
      front: 'Hi',
      meanings: [
        {
          id: 'meaning-123',
          zhMeaning: '嗨',
          enExample: 'Hi there!',
          zhExample: '嗨！',
        },
      ],
    };

    it('應該更新卡片', async () => {
      const updatedCard = {
        ...mockCard,
        front: 'Hi',
        meanings: [
          {
            ...mockMeaning,
            zhMeaning: '嗨',
            enExample: 'Hi there!',
            zhExample: '嗨！',
          },
        ],
      };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockCard);
      mockPrismaService.cardMeaning.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.card.update.mockResolvedValue(updatedCard);

      const result = await service.update(
        mockCardId,
        mockDeckId,
        mockUserId,
        updateDto,
      );

      expect(result.data.front).toBe('Hi');
      expect(result.data.meanings[0].zhMeaning).toBe('嗨');
    });

    it('只更新正面時不應影響詞義', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockCard);
      mockPrismaService.card.update.mockResolvedValue({
        ...mockCard,
        front: 'Hi',
      });

      await service.update(mockCardId, mockDeckId, mockUserId, { front: 'Hi' });

      expect(prisma.cardMeaning.deleteMany).not.toHaveBeenCalled();
    });

    it('卡片不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', mockDeckId, mockUserId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.update(mockCardId, mockDeckId, 'other-user', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('應該刪除卡片', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(mockCard);
      mockPrismaService.card.delete.mockResolvedValue(mockCard);

      await service.delete(mockCardId, mockDeckId, mockUserId);

      expect(mockPrismaService.card.delete).toHaveBeenCalledWith({
        where: { id: mockCardId },
      });
    });

    it('卡片不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.card.findUnique.mockResolvedValue(null);

      await expect(
        service.delete('nonexistent', mockDeckId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.delete(mockCardId, mockDeckId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('importCards', () => {
    const validImportDto = {
      cards: [
        {
          front: 'hello',
          meanings: [
            { zhMeaning: '你好', enExample: 'Hello!', zhExample: '你好！' },
          ],
        },
        {
          front: 'world',
          meanings: [{ zhMeaning: '世界' }],
        },
      ],
    };

    it('應該成功匯入所有有效卡片', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: typeof mockPrismaService) => Promise<void>) => {
        await fn(mockPrismaService);
      });
      mockPrismaService.card.createManyAndReturn.mockResolvedValue([
        { id: 'card-1' },
        { id: 'card-2' },
      ]);
      mockPrismaService.cardMeaning.createMany.mockResolvedValue({ count: 2 });

      const result = await service.importCards(
        mockDeckId,
        mockUserId,
        validImportDto,
      );

      expect(result.total).toBe(2);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('缺少 front 欄位時應該記錄錯誤', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: typeof mockPrismaService) => Promise<void>) => {
        await fn(mockPrismaService);
      });
      mockPrismaService.card.createManyAndReturn.mockResolvedValue([{ id: 'card-1' }]);
      mockPrismaService.cardMeaning.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importCards(mockDeckId, mockUserId, {
        cards: [
          { front: '', meanings: [{ zhMeaning: '你好' }] },
          { front: 'hello', meanings: [{ zhMeaning: '你好' }] },
        ],
      });

      expect(result.total).toBe(2);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        index: 0,
        message: 'front 欄位為必填',
      });
    });

    it('缺少 meanings 欄位時應該記錄錯誤', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: typeof mockPrismaService) => Promise<void>) => {
        await fn(mockPrismaService);
      });
      mockPrismaService.card.createManyAndReturn.mockResolvedValue([{ id: 'card-1' }]);
      mockPrismaService.cardMeaning.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importCards(mockDeckId, mockUserId, {
        cards: [
          { front: 'hello', meanings: [] },
          { front: 'world', meanings: [{ zhMeaning: '世界' }] },
        ],
      });

      expect(result.total).toBe(2);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toEqual({
        index: 0,
        message: 'meanings 欄位須為非空陣列',
      });
    });

    it('meanings 中沒有有效的 zhMeaning 時應該記錄錯誤', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: typeof mockPrismaService) => Promise<void>) => {
        await fn(mockPrismaService);
      });
      mockPrismaService.card.createManyAndReturn.mockResolvedValue([{ id: 'card-1' }]);
      mockPrismaService.cardMeaning.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importCards(mockDeckId, mockUserId, {
        cards: [
          { front: 'hello', meanings: [{ zhMeaning: '' }] },
          { front: 'world', meanings: [{ zhMeaning: '世界' }] },
        ],
      });

      expect(result.total).toBe(2);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toEqual({
        index: 0,
        message: '至少需要一筆有效的 zhMeaning',
      });
    });

    it('牌組不存在時應該拋出 NotFoundException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);

      await expect(
        service.importCards('nonexistent', mockUserId, validImportDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('使用者無權限時應該拋出 ForbiddenException', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);

      await expect(
        service.importCards(mockDeckId, 'other-user', validImportDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
