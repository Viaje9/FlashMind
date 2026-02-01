import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeckService } from './deck.service';
import { PrismaService } from '../../prisma/prisma.service';

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
    },
    reviewLog: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const mockUserId = 'user-123';
  const mockDeck = {
    id: 'deck-123',
    name: '英文單字',
    dailyNewCards: 20,
    dailyReviewCards: 100,
    dailyResetHour: 4,
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

      const result = await service.findAllByUserId(mockUserId);

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
      });
    });

    it('使用者沒有牌組時應該回傳空陣列', async () => {
      mockPrismaService.deck.findMany.mockResolvedValue([]);

      const result = await service.findAllByUserId(mockUserId);

      expect(result).toEqual([]);
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
          userId: mockUserId,
        },
      });
      expect(result.data).toEqual({
        id: 'deck-123',
        name: '英文單字',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        dailyResetHour: 4,
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
          userId: mockUserId,
        },
      });
    });
  });

  describe('update', () => {
    it('應該更新牌組名稱', async () => {
      const updatedDeck = { ...mockDeck, name: '新名稱' };
      mockPrismaService.deck.findUnique.mockResolvedValue(mockDeck);
      mockPrismaService.deck.update.mockResolvedValue(updatedDeck);

      const result = await service.update('deck-123', mockUserId, { name: '新名稱' });

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

      const result = await service.update('deck-123', mockUserId, { dailyNewCards: 50 });

      expect(prisma.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-123' },
        data: { dailyNewCards: 50 },
      });
      expect(result.data.dailyNewCards).toBe(50);
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
});
