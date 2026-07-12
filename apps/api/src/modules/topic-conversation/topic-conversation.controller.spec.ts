import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import type { AuthenticatedRequest } from '../auth/auth.guard';
import { SessionService } from '../auth/session.service';
import { TopicConversationController } from './topic-conversation.controller';
import { TopicConversationService } from './topic-conversation.service';

describe('TopicConversationController', () => {
  let controller: TopicConversationController;
  let service: {
    createConversation: jest.Mock;
    listConversations: jest.Mock;
    getConversation: jest.Mock;
    createMessage: jest.Mock;
    createHint: jest.Mock;
    replayConversation: jest.Mock;
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
      createConversation: jest.fn(),
      listConversations: jest.fn(),
      getConversation: jest.fn(),
      createMessage: jest.fn(),
      createHint: jest.fn(),
      replayConversation: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopicConversationController],
      providers: [
        { provide: TopicConversationService, useValue: service },
        { provide: SessionService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(TopicConversationController);
  });

  it('建立與列表會帶入目前使用者', async () => {
    await controller.createConversation(req);
    await controller.listConversations(req, { limit: 20 });

    expect(service.createConversation).toHaveBeenCalledWith('user-1');
    expect(service.listConversations).toHaveBeenCalledWith('user-1', {
      limit: 20,
    });
  });

  it('詳情、訊息與提示都會限制目前使用者和場次', async () => {
    const dto = { message: 'I am looking for a mystery novel.' };

    await controller.getConversation(req, 'session-1');
    await controller.createMessage(req, 'session-1', dto);
    await controller.createHint(req, 'session-1');

    expect(service.getConversation).toHaveBeenCalledWith('user-1', 'session-1');
    expect(service.createMessage).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      dto,
    );
    expect(service.createHint).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('再練一次會建立同主題的新場次', async () => {
    await controller.replayConversation(req, 'session-1');

    expect(service.replayConversation).toHaveBeenCalledWith(
      'user-1',
      'session-1',
    );
  });
});
