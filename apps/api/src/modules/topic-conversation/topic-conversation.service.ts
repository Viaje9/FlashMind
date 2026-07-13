import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  TopicConversationCorrectionStatus,
  TopicConversationRole,
  type TopicConversationMessage,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateTopicConversationMessageDto,
  ListTopicConversationsDto,
} from './dto';
import {
  TopicConversationAiProvider,
  type TopicConversationCorrection,
} from './topic-conversation-ai.provider';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const TOPIC_HISTORY_LIMIT = 100;
const MAX_TOPIC_GENERATION_ATTEMPTS = 3;

const SESSION_INCLUDE = {
  topic: true,
  messages: {
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class TopicConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: TopicConversationAiProvider,
  ) {}

  async createConversation(userId: string) {
    await this.prisma.topicConversationTopic.deleteMany({
      where: {
        userId,
        sessions: { none: { startedAt: { not: null } } },
      },
    });
    const excludedTopics = await this.prisma.topicConversationTopic.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: TOPIC_HISTORY_LIMIT,
      select: { title: true, scenario: true },
    });

    for (
      let attempt = 0;
      attempt < MAX_TOPIC_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const generated = await this.aiProvider.generateTopic({ excludedTopics });
      const title = generated.title.trim();
      const scenario = generated.scenario.trim();
      const openingMessage = generated.openingMessage.trim();

      if (!title || !scenario || !openingMessage) {
        throw this.aiError();
      }

      try {
        const topic = await this.prisma.topicConversationTopic.create({
          data: {
            userId,
            title,
            scenario,
            normalizedTitle: this.normalizeTitle(title),
            sessions: {
              create: {
                messages: {
                  create: {
                    role: TopicConversationRole.ASSISTANT,
                    content: openingMessage,
                  },
                },
              },
            },
          },
          include: {
            sessions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: SESSION_INCLUDE,
            },
          },
        });

        const session = topic.sessions[0];
        if (!session) throw this.aiError();
        return { data: this.mapSession(session) };
      } catch (error) {
        if (!this.isUniqueConflict(error)) throw error;
        excludedTopics.push({ title, scenario });
      }
    }

    throw new ConflictException({
      error: {
        code: 'TOPIC_CONVERSATION_DUPLICATE_TOPIC',
        message: '暫時找不到不同的新主題，請稍後再試',
      },
    });
  }

  async listConversations(userId: string, query: ListTopicConversationsDto) {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
    const cursorId = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const sessions = await this.prisma.topicConversationSession.findMany({
      where: { topic: { userId }, startedAt: { not: null } },
      include: {
        topic: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const hasMore = sessions.length > limit;
    const visible = hasMore ? sessions.slice(0, limit) : sessions;

    return {
      data: visible.map((session) => ({
        id: session.id,
        topic: this.mapTopic(session.topic),
        messageCount: session._count.messages,
        lastMessagePreview: session.messages[0]?.content ?? '',
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      })),
      meta: {
        hasMore,
        nextCursor: hasMore
          ? this.encodeCursor(visible[visible.length - 1].id)
          : null,
      },
    };
  }

  async getConversation(userId: string, sessionId: string) {
    const session = await this.findOwnedSession(userId, sessionId);
    return { data: this.mapSession(session) };
  }

  async createMessage(
    userId: string,
    sessionId: string,
    dto: CreateTopicConversationMessageDto,
  ) {
    return this.createMessageInternal(userId, sessionId, dto);
  }

  async createMessageStream(
    userId: string,
    sessionId: string,
    dto: CreateTopicConversationMessageDto,
    onReplyDelta: (delta: string) => void | Promise<void>,
  ) {
    return this.createMessageInternal(userId, sessionId, dto, onReplyDelta);
  }

  private async createMessageInternal(
    userId: string,
    sessionId: string,
    dto: CreateTopicConversationMessageDto,
    onReplyDelta?: (delta: string) => void | Promise<void>,
  ) {
    const message = dto.message.trim();
    if (!message) throw this.validationError('訊息不可為空');

    const session = await this.findOwnedSession(userId, sessionId);
    const [userMessage] = await this.prisma.$transaction([
      this.prisma.topicConversationMessage.create({
        data: {
          sessionId,
          role: TopicConversationRole.USER,
          content: message,
        },
      }),
      this.prisma.topicConversationSession.update({
        where: { id: sessionId },
        data: {
          updatedAt: new Date(),
          ...(session.startedAt ? {} : { startedAt: new Date() }),
        },
      }),
    ]);
    const result = await this.aiProvider.continueConversation({
      topic: {
        title: session.topic.title,
        scenario: session.topic.scenario,
      },
      history: session.messages.map((item) => ({
        role: item.role.toLowerCase() as 'user' | 'assistant',
        content: item.content,
      })),
      message,
      onReplyDelta,
    });
    const correction = this.normalizeCorrection(result.correction);

    const [, assistantMessage] = await this.prisma.$transaction([
      this.prisma.topicConversationMessage.update({
        where: { id: userMessage.id },
        data: {
          correctionStatus: this.toPrismaCorrectionStatus(correction.status),
          correctedText: correction.correctedText,
          correctionExplanation: correction.explanation,
        },
      }),
      this.prisma.topicConversationMessage.create({
        data: {
          sessionId,
          role: TopicConversationRole.ASSISTANT,
          content: result.reply.trim(),
        },
      }),
    ]);

    return {
      data: {
        userMessage: this.mapMessage({
          ...userMessage,
          correctionStatus: this.toPrismaCorrectionStatus(correction.status),
          correctedText: correction.correctedText,
          correctionExplanation: correction.explanation,
        }),
        assistantMessage: this.mapMessage(assistantMessage),
      },
    };
  }

  async createHint(userId: string, sessionId: string) {
    const session = await this.findOwnedSession(userId, sessionId);
    const result = await this.aiProvider.generateHint({
      topic: {
        title: session.topic.title,
        scenario: session.topic.scenario,
      },
      history: session.messages.map((item) => ({
        role: item.role.toLowerCase() as 'user' | 'assistant',
        content: item.content,
      })),
    });

    return {
      data: {
        suggestions: [...new Set(result.suggestions.map((item) => item.trim()))]
          .filter(Boolean)
          .slice(0, 3),
      },
    };
  }

  async replayConversation(userId: string, sessionId: string) {
    const source = await this.findOwnedSession(userId, sessionId);
    const openingMessage = source.messages.find(
      (message) => message.role === TopicConversationRole.ASSISTANT,
    );
    if (!openingMessage) throw this.notFound();

    const session = await this.prisma.topicConversationSession.create({
      data: {
        topicId: source.topic.id,
        messages: {
          create: {
            role: TopicConversationRole.ASSISTANT,
            content: openingMessage.content,
          },
        },
      },
      include: SESSION_INCLUDE,
    });

    return { data: this.mapSession(session) };
  }

  async deleteConversation(userId: string, sessionId: string) {
    await this.findOwnedSession(userId, sessionId);
    await this.prisma.topicConversationSession.delete({
      where: { id: sessionId },
    });
  }

  private async findOwnedSession(userId: string, sessionId: string) {
    const session = await this.prisma.topicConversationSession.findFirst({
      where: { id: sessionId, topic: { userId } },
      include: SESSION_INCLUDE,
    });
    if (!session) throw this.notFound();
    return session;
  }

  private mapSession(session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    topic: {
      id: string;
      title: string;
      scenario: string;
      createdAt: Date;
      updatedAt: Date;
    };
    messages: TopicConversationMessage[];
  }) {
    return {
      id: session.id,
      topic: this.mapTopic(session.topic),
      messages: session.messages.map((message) => this.mapMessage(message)),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private mapTopic(topic: {
    id: string;
    title: string;
    scenario: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: topic.id,
      title: topic.title,
      scenario: topic.scenario,
      createdAt: topic.createdAt.toISOString(),
      updatedAt: topic.updatedAt.toISOString(),
    };
  }

  private mapMessage(message: TopicConversationMessage) {
    return {
      id: message.id,
      role: message.role.toLowerCase(),
      content: message.content,
      correction: message.correctionStatus
        ? {
            status: message.correctionStatus.toLowerCase(),
            suggestedText: message.correctedText,
            explanation: message.correctionExplanation,
          }
        : null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private normalizeCorrection(
    correction: TopicConversationCorrection,
  ): TopicConversationCorrection {
    if (correction.status === 'correct') {
      return { status: 'correct', correctedText: null, explanation: null };
    }

    return {
      status: correction.status,
      correctedText: correction.correctedText?.trim() || null,
      explanation: correction.explanation?.trim() || null,
    };
  }

  private toPrismaCorrectionStatus(
    status: TopicConversationCorrection['status'],
  ) {
    return TopicConversationCorrectionStatus[
      status.toUpperCase() as keyof typeof TopicConversationCorrectionStatus
    ];
  }

  private normalizeTitle(title: string): string {
    return title
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, '');
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private encodeCursor(id: string): string {
    return Buffer.from(id, 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): string {
    try {
      const value = Buffer.from(cursor, 'base64url').toString('utf8').trim();
      if (!value) throw new Error('empty');
      return value;
    } catch {
      throw this.validationError('cursor 格式錯誤');
    }
  }

  private notFound() {
    return new NotFoundException({
      error: {
        code: 'TOPIC_CONVERSATION_NOT_FOUND',
        message: '找不到主題對話',
      },
    });
  }

  private validationError(message: string) {
    return new BadRequestException({
      error: { code: 'VALIDATION_ERROR', message },
    });
  }

  private aiError() {
    return new ServiceUnavailableException({
      error: {
        code: 'TOPIC_CONVERSATION_AI_ERROR',
        message: '主題對話服務暫時無法使用，請稍後再試',
      },
    });
  }
}
