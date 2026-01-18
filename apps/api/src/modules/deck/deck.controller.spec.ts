import { Test, TestingModule } from '@nestjs/testing';
import { DeckController } from './deck.controller';
import { DeckService } from './deck.service';
import { AuthGuard } from '../auth/auth.guard';

describe('DeckController', () => {
  let controller: DeckController;
  let service: DeckService;

  const mockDeckService = {
    findAllByUserId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockRequest = { user: mockUser } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeckController],
      providers: [{ provide: DeckService, useValue: mockDeckService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<DeckController>(DeckController);
    service = module.get<DeckService>(DeckService);

    jest.clearAllMocks();
  });

  describe('listDecks', () => {
    it('應該回傳使用者的牌組列表', async () => {
      const mockDecks = [
        {
          id: 'deck-1',
          name: '英文單字',
          newCount: 10,
          reviewCount: 20,
          totalCount: 100,
          completedCount: 70,
          progress: 70,
        },
      ];
      mockDeckService.findAllByUserId.mockResolvedValue(mockDecks);

      const result = await controller.listDecks(mockRequest);

      expect(service.findAllByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ data: mockDecks });
    });
  });

  describe('createDeck', () => {
    it('應該建立新牌組', async () => {
      const dto = { name: '英文單字' };
      const mockResponse = {
        data: {
          id: 'deck-1',
          name: '英文單字',
          dailyNewCards: 20,
          dailyReviewCards: 100,
          createdAt: '2026-01-17T10:00:00.000Z',
          updatedAt: '2026-01-17T10:00:00.000Z',
        },
      };
      mockDeckService.create.mockResolvedValue(mockResponse);

      const result = await controller.createDeck(mockRequest, dto);

      expect(service.create).toHaveBeenCalledWith('user-123', dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getDeck', () => {
    it('應該回傳牌組詳情', async () => {
      const mockDeck = {
        id: 'deck-1',
        name: '英文單字',
        dailyNewCards: 20,
        dailyReviewCards: 100,
        stats: {
          newCount: 10,
          reviewCount: 20,
          totalCount: 100,
          createdAt: '2026-01-17T10:00:00.000Z',
          lastStudiedAt: null,
        },
      };
      mockDeckService.findById.mockResolvedValue(mockDeck);

      const result = await controller.getDeck(mockRequest, 'deck-1');

      expect(service.findById).toHaveBeenCalledWith('deck-1', 'user-123');
      expect(result).toEqual({ data: mockDeck });
    });
  });

  describe('updateDeck', () => {
    it('應該更新牌組', async () => {
      const dto = { name: '新名稱' };
      const mockResponse = {
        data: {
          id: 'deck-1',
          name: '新名稱',
          dailyNewCards: 20,
          dailyReviewCards: 100,
          createdAt: '2026-01-17T10:00:00.000Z',
          updatedAt: '2026-01-17T10:00:00.000Z',
        },
      };
      mockDeckService.update.mockResolvedValue(mockResponse);

      const result = await controller.updateDeck(mockRequest, 'deck-1', dto);

      expect(service.update).toHaveBeenCalledWith('deck-1', 'user-123', dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteDeck', () => {
    it('應該刪除牌組', async () => {
      mockDeckService.delete.mockResolvedValue(undefined);

      await controller.deleteDeck(mockRequest, 'deck-1');

      expect(service.delete).toHaveBeenCalledWith('deck-1', 'user-123');
    });
  });
});
