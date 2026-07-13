import { NotFoundException } from '@nestjs/common';
import {
  TopicConversationCorrectionStatus,
  TopicConversationRole,
} from '@prisma/client';

import { TopicConversationService } from './topic-conversation.service';

describe('TopicConversationService', () => {
  const now = new Date('2026-07-12T08:00:00.000Z');

  function topicFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'topic-1',
      userId: 'user-1',
      title: '在書店找一本書',
      scenario: '你正在向店員詢問一本找不到的書。',
      normalizedTitle: '在書店找一本書',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  function sessionFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'session-1',
      topicId: 'topic-1',
      createdAt: now,
      updatedAt: now,
      topic: topicFixture(),
      messages: [
        {
          id: 'message-1',
          sessionId: 'session-1',
          role: TopicConversationRole.ASSISTANT,
          content: 'Hi! Can I help you find a book today?',
          correctionStatus: null,
          correctedText: null,
          correctionExplanation: null,
          createdAt: now,
        },
      ],
      ...overrides,
    };
  }

  function createService() {
    const prisma = {
      topicConversationTopic: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      topicConversationSession: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      topicConversationMessage: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const aiProvider = {
      generateTopic: jest.fn(),
      continueConversation: jest.fn(),
      generateHint: jest.fn(),
    };

    return {
      prisma,
      aiProvider,
      service: new TopicConversationService(prisma as any, aiProvider as any),
    };
  }

  it('產生草稿時不寫入資料庫，確認開始後才保存 AI 開場', async () => {
    const { service, prisma, aiProvider } = createService();
    prisma.topicConversationTopic.findMany.mockResolvedValue([
      { title: '在咖啡店點餐', scenario: '向店員點一杯飲料。' },
    ]);
    aiProvider.generateTopic.mockResolvedValue({
      title: '在書店找一本書',
      scenario: '你正在向店員詢問一本找不到的書。',
      openingMessage: 'Hi! Can I help you find a book today?',
    });
    prisma.topicConversationTopic.create.mockResolvedValue({
      ...topicFixture(),
      sessions: [sessionFixture()],
    });

    const draft = await service.createDraft('user-1');

    expect(aiProvider.generateTopic).toHaveBeenCalledWith({
      excludedTopics: [
        { title: '在咖啡店點餐', scenario: '向店員點一杯飲料。' },
      ],
    });
    expect(prisma.topicConversationTopic.create).not.toHaveBeenCalled();

    const result = await service.createConversation('user-1', draft.data);
    expect(prisma.topicConversationTopic.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          title: '在書店找一本書',
          normalizedTitle: '在書店找一本書',
          sessions: {
            create: {
              messages: {
                create: {
                  role: TopicConversationRole.ASSISTANT,
                  content: 'Hi! Can I help you find a book today?',
                },
              },
            },
          },
        }),
      }),
    );
    expect(result.data.id).toBe('session-1');
  });

  it('送出訊息會保存原句、結構化修正與 AI 回覆', async () => {
    const { service, prisma, aiProvider } = createService();
    prisma.topicConversationSession.findFirst.mockResolvedValue(
      sessionFixture(),
    );
    prisma.topicConversationMessage.create
      .mockResolvedValueOnce({
        id: 'user-message-1',
        sessionId: 'session-1',
        role: TopicConversationRole.USER,
        content: 'I looking for mystery novel.',
        correctionStatus: null,
        correctedText: null,
        correctionExplanation: null,
        createdAt: now,
      })
      .mockResolvedValueOnce({
        id: 'assistant-message-2',
        sessionId: 'session-1',
        role: TopicConversationRole.ASSISTANT,
        content: 'Sure. What kind of stories do you enjoy?',
        correctionStatus: null,
        correctedText: null,
        correctionExplanation: null,
        createdAt: now,
      });
    aiProvider.continueConversation.mockResolvedValue({
      reply: 'Sure. What kind of stories do you enjoy?',
      correction: {
        status: 'corrected',
        correctedText: 'I am looking for a mystery novel.',
        explanation: 'look for 前面需要 be 動詞，且 mystery novel 前要加冠詞。',
      },
    });

    const result = await service.createMessage('user-1', 'session-1', {
      message: 'I looking for mystery novel.',
    });

    expect(aiProvider.continueConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: expect.objectContaining({ title: '在書店找一本書' }),
        history: [
          {
            role: 'assistant',
            content: 'Hi! Can I help you find a book today?',
          },
        ],
        message: 'I looking for mystery novel.',
      }),
    );
    expect(prisma.topicConversationMessage.update).toHaveBeenCalledWith({
      where: { id: 'user-message-1' },
      data: {
        correctionStatus: TopicConversationCorrectionStatus.CORRECTED,
        correctedText: 'I am looking for a mystery novel.',
        correctionExplanation:
          'look for 前面需要 be 動詞，且 mystery novel 前要加冠詞。',
      },
    });
    expect(result.data.userMessage.correction.status).toBe('corrected');
    expect(result.data.assistantMessage.content).toContain(
      'What kind of stories',
    );
  });

  it('串流送出訊息時會即時轉送 AI reply delta 並保存最終結果', async () => {
    const { service, prisma, aiProvider } = createService();
    const onReplyDelta = jest.fn();
    prisma.topicConversationSession.findFirst.mockResolvedValue(
      sessionFixture(),
    );
    prisma.topicConversationMessage.create
      .mockResolvedValueOnce({
        id: 'user-message-1',
        sessionId: 'session-1',
        role: TopicConversationRole.USER,
        content: 'I need a mystery novel.',
        correctionStatus: null,
        correctedText: null,
        correctionExplanation: null,
        createdAt: now,
      })
      .mockResolvedValueOnce({
        id: 'assistant-message-2',
        sessionId: 'session-1',
        role: TopicConversationRole.ASSISTANT,
        content: 'Sure. Do you prefer a classic or modern story?',
        correctionStatus: null,
        correctedText: null,
        correctionExplanation: null,
        createdAt: now,
      });
    aiProvider.continueConversation.mockImplementation(async (input) => {
      await input.onReplyDelta?.('Sure. ');
      await input.onReplyDelta?.('Do you prefer a classic or modern story?');
      return {
        reply: 'Sure. Do you prefer a classic or modern story?',
        correction: {
          status: 'correct',
          correctedText: null,
          explanation: null,
        },
      };
    });

    const result = await service.createMessageStream(
      'user-1',
      'session-1',
      { message: 'I need a mystery novel.' },
      onReplyDelta,
    );

    expect(onReplyDelta.mock.calls.map(([delta]) => delta)).toEqual([
      'Sure. ',
      'Do you prefer a classic or modern story?',
    ]);
    expect(aiProvider.continueConversation).toHaveBeenCalledWith(
      expect.objectContaining({ onReplyDelta }),
    );
    expect(result.data.assistantMessage.content).toBe(
      'Sure. Do you prefer a classic or modern story?',
    );
  });

  it('提示只呼叫 AI，不新增聊天訊息', async () => {
    const { service, prisma, aiProvider } = createService();
    prisma.topicConversationSession.findFirst.mockResolvedValue(
      sessionFixture(),
    );
    aiProvider.generateHint.mockResolvedValue({
      suggestions: [
        'I enjoy mystery stories.',
        'I like books with surprising endings.',
      ],
    });

    const result = await service.createHint('user-1', 'session-1');

    expect(result.data.suggestions).toHaveLength(2);
    expect(prisma.topicConversationMessage.create).not.toHaveBeenCalled();
  });

  it('草稿提示不需要先建立場次', async () => {
    const { service, prisma, aiProvider } = createService();
    aiProvider.generateHint.mockResolvedValue({
      suggestions: ['I need some help.'],
    });

    const result = await service.createDraftHint({
      title: '在書店找一本書',
      scenario: '你正在向店員詢問一本找不到的書。',
      openingMessage: 'Can I help you find a book?',
    });

    expect(result.data.suggestions).toEqual(['I need some help.']);
    expect(prisma.topicConversationSession.findFirst).not.toHaveBeenCalled();
  });

  it('讀取不屬於目前使用者的場次時回傳找不到資源', async () => {
    const { service, prisma } = createService();
    prisma.topicConversationSession.findFirst.mockResolvedValue(null);

    await expect(
      service.getConversation('user-2', 'session-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.topicConversationSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1', topic: { userId: 'user-2' } },
      }),
    );
  });

  it('再練一次會沿用主題與原開場，建立新的獨立場次', async () => {
    const { service, prisma } = createService();
    prisma.topicConversationSession.findFirst.mockResolvedValue(
      sessionFixture(),
    );
    prisma.topicConversationSession.create.mockResolvedValue(
      sessionFixture({ id: 'session-2' }),
    );

    const result = await service.replayConversation('user-1', 'session-1');

    expect(prisma.topicConversationSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          topicId: 'topic-1',
          messages: {
            create: {
              role: TopicConversationRole.ASSISTANT,
              content: 'Hi! Can I help you find a book today?',
            },
          },
        },
      }),
    );
    expect(result.data.id).toBe('session-2');
  });

  it('歷史直接列出已建立的場次', async () => {
    const { service, prisma } = createService();
    prisma.topicConversationSession.findMany.mockResolvedValue([]);

    await service.listConversations('user-1', {});

    expect(prisma.topicConversationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { topic: { userId: 'user-1' } },
      }),
    );
  });

  it('刪除擁有的場次時會一併交由 cascade 清除訊息', async () => {
    const { service, prisma } = createService();
    prisma.topicConversationSession.findFirst.mockResolvedValue(
      sessionFixture(),
    );

    await service.deleteConversation('user-1', 'session-1');

    expect(prisma.topicConversationSession.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
  });
});
