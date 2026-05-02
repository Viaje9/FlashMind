import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionItemKindDto } from './dto';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { SessionService } from '../auth/session.service';

describe('CollectionController', () => {
  let controller: CollectionController;
  let service: {
    listItems: jest.Mock;
    createItem: jest.Mock;
    deleteItem: jest.Mock;
    createChatSession: jest.Mock;
    createChatMessage: jest.Mock;
  };
  const req = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      timezone: 'Asia/Taipei',
    },
  } as AuthenticatedRequest;

  beforeEach(async () => {
    service = {
      listItems: jest.fn(),
      createItem: jest.fn(),
      deleteItem: jest.fn(),
      createChatSession: jest.fn(),
      createChatMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionController],
      providers: [
        {
          provide: CollectionService,
          useValue: service,
        },
        {
          provide: SessionService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(CollectionController);
  });

  it('列表查詢會帶入目前使用者與 query', async () => {
    service.listItems.mockResolvedValue({ data: [], meta: { hasMore: false } });

    await controller.listItems(req, {
      kind: CollectionItemKindDto.COLLOCATION,
      q: 'schedule',
    });

    expect(service.listItems).toHaveBeenCalledWith('user-1', {
      kind: CollectionItemKindDto.COLLOCATION,
      q: 'schedule',
    });
  });

  it('新增收藏會帶入目前使用者與 body', async () => {
    const dto = {
      kind: CollectionItemKindDto.COLLOCATION,
      text: 'fall behind schedule',
    };
    service.createItem.mockResolvedValue({ data: { id: 'item-1' } });

    await controller.createItem(req, dto);

    expect(service.createItem).toHaveBeenCalledWith('user-1', dto);
  });

  it('刪除收藏會限制目前使用者', async () => {
    service.deleteItem.mockResolvedValue(undefined);

    await controller.deleteItem(req, 'item-1');

    expect(service.deleteItem).toHaveBeenCalledWith('user-1', 'item-1');
  });

  it('建立聊天 session 會限制目前使用者', async () => {
    service.createChatSession.mockResolvedValue({ data: { id: 'session-1' } });

    await controller.createChatSession(req);

    expect(service.createChatSession).toHaveBeenCalledWith('user-1');
  });

  it('送出聊天訊息會帶入目前使用者、session 與 body', async () => {
    const dto = { message: '我想延期會議' };
    service.createChatMessage.mockResolvedValue({
      data: { sessionId: 'session-1' },
    });

    await controller.createChatMessage(req, 'session-1', dto);

    expect(service.createChatMessage).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      dto,
    );
  });
});
