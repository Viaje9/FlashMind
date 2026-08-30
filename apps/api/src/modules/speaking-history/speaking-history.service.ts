import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type SpeakingMessage,
  type SpeakingWriteReceipt,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  canonicalJson,
  speakingSourceKey,
  validateStructure,
  validateReviewDraft,
  SPEAKING_MAX_BYTES,
  type SpeakingHistoryMessage,
  type SpeakingSessionCreate,
  type SpeakingMessagesAppend,
  type SpeakingReviewDraft,
  type SpeakingReviewValidation,
  type SpeakingSavedReview,
  type SpeakingPracticeContext,
  type SpeakingContextWord,
  type SpeakingSessionRecord,
  type SpeakingSessionDetail,
  type SpeakingRecordedResult,
  type SpeakingHistoryMigration,
  type SpeakingLegacySession,
  type SpeakingMigrationResult,
  type SpeakingPracticePlan,
} from '@flashmind/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetVocabularyService } from '../target-vocabulary/target-vocabulary.service';

const include = {
  review: true,
  legacySummaries: { orderBy: { ordinal: 'asc' as const } },
  _count: { select: { messages: true } },
};
type Session = Prisma.SpeakingSessionGetPayload<{ include: typeof include }>;
type Db = Prisma.TransactionClient;
type PageQuery = { cursor?: string; limit?: number };
const digest = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const appRef = (id: string) => ({
  system: 'flashmind',
  conversationId: id,
  sessionKey: 'app',
});
const sourceKey = (ref: SpeakingReviewDraft['practice']['sourceRef']) =>
  digest(speakingSourceKey(ref));
const conflict = (message = '相同練習已有不同內容，請重新讀取紀錄') =>
  new ConflictException({ error: { code: 'SPEAKING_CONFLICT', message } });

@Injectable()
export class SpeakingHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly vocabulary: TargetVocabularyService,
  ) {}

  private check(
    name: Parameters<typeof validateStructure>[0],
    value: unknown,
  ): void {
    const errors = validateStructure(name, value);
    if (errors.length)
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: '資料格式錯誤',
          details: errors,
        },
      });
  }

  private async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(fn, {
          isolationLevel: 'Serializable',
          timeout: 15000,
        });
      } catch (error) {
        if (
          attempt < 3 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        )
          continue;
        throw error;
      }
    }
  }

  private async owned(tx: Db, userId: string, id: string): Promise<Session> {
    const session = await tx.speakingSession.findFirst({
      where: { id, userId },
      include,
    });
    if (!session)
      throw new NotFoundException({
        error: { code: 'SPEAKING_NOT_FOUND', message: '找不到口說紀錄' },
      });
    return session;
  }

  private record(session: Session): SpeakingSessionRecord {
    return {
      id: session.id,
      clientSessionId: session.clientSessionId,
      source: session.source,
      title: session.title,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      revision: session.revision,
      messageCount: session._count.messages,
      reviewed: !!session.review || session.legacySummaries.length > 0,
      summary:
        session.review?.summary ?? session.legacySummaries.at(-1)?.text ?? null,
    };
  }

  private message(message: SpeakingMessage): SpeakingHistoryMessage {
    return {
      id: message.clientMessageId,
      role: message.role as 'user' | 'assistant',
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      ...(message.translatedText
        ? { translatedText: message.translatedText }
        : {}),
      hasOriginalAudio: message.hasOriginalAudio,
      transcriptStatus: message.transcriptStatus as 'available' | 'unavailable',
    };
  }

  private messageData(message: SpeakingHistoryMessage, ordinal: number) {
    return {
      clientMessageId: message.id,
      ordinal,
      role: message.role,
      text: message.text,
      createdAt: new Date(message.createdAt),
      translatedText: message.translatedText ?? null,
      hasOriginalAudio: message.hasOriginalAudio ?? false,
      transcriptStatus: message.transcriptStatus ?? 'available',
    };
  }

  private sameMessage(
    a: SpeakingHistoryMessage,
    b: SpeakingHistoryMessage,
  ): boolean {
    return (
      canonicalJson(this.messageData(a, 0)) ===
      canonicalJson(this.messageData(b, 0))
    );
  }

  private cursor(
    value: string | undefined,
    kind: string,
    owner: string,
  ): Record<string, unknown> | null {
    if (!value) return null;
    try {
      if (value.length > 1000) throw new Error();
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString(),
      ) as Record<string, unknown>;
      if (parsed.kind !== kind || parsed.owner !== owner) throw new Error();
      return parsed;
    } catch {
      throw new BadRequestException({
        error: { code: 'INVALID_CURSOR', message: '分頁游標無效' },
      });
    }
  }

  private pageSize(query: PageQuery): number {
    const limit = query.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException({
        error: { code: 'INVALID_LIMIT', message: 'limit 須介於 1 到 100' },
      });
    return limit;
  }

  private checkExpectedAccount(userId: string, expectedUserId: string) {
    if (userId !== expectedUserId)
      throw new ForbiddenException({
        error: {
          code: 'ACCOUNT_CHANGED',
          message: '登入帳號已變更，請重新確認帳號',
        },
      });
  }

  async createSession(
    userId: string,
    input: SpeakingSessionCreate,
  ): Promise<SpeakingSessionRecord> {
    this.check('SpeakingSessionCreate', input);
    this.checkExpectedAccount(userId, input.expectedUserId);
    return this.transaction(async (tx) => {
      const key = sourceKey(appRef(input.clientSessionId));
      const receipt = await tx.speakingWriteReceipt.findUnique({
        where: {
          userId_source_sourceKey: { userId, source: 'APP', sourceKey: key },
        },
      });
      if (receipt) {
        if (receipt.deletedAt || receipt.initialContentHash !== digest(input))
          throw conflict();
        return this.record(await this.owned(tx, userId, receipt.sessionId));
      }
      const session = await tx.speakingSession.create({
        data: {
          userId,
          source: 'APP',
          sourceKey: key,
          clientSessionId: input.clientSessionId,
          title: input.title,
          startedAt: new Date(input.startedAt),
        },
        include,
      });
      await tx.speakingWriteReceipt.create({
        data: {
          userId,
          source: 'APP',
          sourceKey: key,
          sessionId: session.id,
          initialContentHash: digest(input),
        },
      });
      return this.record(session);
    });
  }

  async appendMessages(
    userId: string,
    id: string,
    input: SpeakingMessagesAppend,
  ): Promise<SpeakingSessionRecord> {
    this.check('SpeakingMessagesAppend', input);
    this.checkExpectedAccount(userId, input.expectedUserId);
    return this.transaction(async (tx) => {
      const session = await this.owned(tx, userId, id);
      const existing = await tx.speakingMessage.findMany({
        where: { sessionId: id },
        orderBy: { ordinal: 'asc' },
      });
      const byId = new Map(
        existing.map((message) => [message.clientMessageId, message]),
      );
      const newMessages: SpeakingHistoryMessage[] = [];
      const ids = new Set<string>();
      for (const message of input.messages) {
        if (ids.has(message.id)) throw conflict('訊息 ID 不得重複');
        ids.add(message.id);
        const saved = byId.get(message.id);
        if (saved && !this.sameMessage(this.message(saved), message))
          throw conflict('已保存的訊息內容不同');
        if (!saved) newMessages.push(message);
      }
      if (!newMessages.length) return this.record(session);
      if (
        session.source !== 'APP' ||
        session.review ||
        session.legacySummaries.length
      )
        throw conflict('已整理的紀錄不可追加，請建立新練習');
      if (session.revision !== input.revision)
        throw conflict('場次版本已更新，請重新讀取後再試');
      if (existing.length + newMessages.length > 2000)
        throw new UnprocessableEntityException({
          error: { code: 'MESSAGE_LIMIT', message: '每場最多 2000 則訊息' },
        });
      let previous =
        existing.at(-1)?.createdAt.getTime() ?? session.startedAt.getTime();
      for (const message of newMessages) {
        const date = Date.parse(message.createdAt);
        if (
          date < previous ||
          (input.endedAt && date > Date.parse(input.endedAt))
        )
          throw new BadRequestException({
            error: { code: 'TIME_INVALID', message: '訊息時間不在有效順序內' },
          });
        if (!message.text.trim() && message.transcriptStatus !== 'unavailable')
          throw new BadRequestException({
            error: {
              code: 'TRANSCRIPT_REQUIRED',
              message: '空文字須明確標記逐字稿不可用',
            },
          });
        previous = date;
      }
      await tx.speakingMessage.createMany({
        data: newMessages.map((message, index) => ({
          ...this.messageData(message, existing.length + index),
          sessionId: id,
        })),
      });
      return this.record(
        await tx.speakingSession.update({
          where: { id },
          data: {
            revision: { increment: 1 },
            ...(input.endedAt ? { endedAt: new Date(input.endedAt) } : {}),
          },
          include,
        }),
      );
    });
  }

  async listSessions(userId: string, query: PageQuery) {
    const limit = this.pageSize(query),
      cursor = this.cursor(query.cursor, 'sessions', userId);
    if (
      cursor &&
      (typeof cursor.id !== 'string' ||
        typeof cursor.time !== 'string' ||
        !Number.isFinite(Date.parse(cursor.time)))
    )
      throw new BadRequestException({
        error: { code: 'INVALID_CURSOR', message: '無效的時間游標' },
      });
    const data = await this.prisma.speakingSession.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { startedAt: { lt: new Date(cursor.time as string) } },
                {
                  startedAt: new Date(cursor.time as string),
                  id: { lt: cursor.id as string },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include,
    });
    const hasMore = data.length > limit,
      rows = data.slice(0, limit),
      last = rows.at(-1);
    return {
      data: rows.map((row) => this.record(row)),
      meta: {
        hasMore,
        nextCursor:
          hasMore && last
            ? Buffer.from(
                JSON.stringify({
                  kind: 'sessions',
                  owner: userId,
                  time: last.startedAt.toISOString(),
                  id: last.id,
                }),
              ).toString('base64url')
            : null,
      },
    };
  }

  async getSession(userId: string, id: string): Promise<SpeakingSessionDetail> {
    const session = await this.owned(this.prisma, userId, id);
    return {
      session: this.record(session),
      review: session.review
        ? (session.review.payload as unknown as SpeakingRecordedResult)
        : null,
      legacySummaries: session.legacySummaries.map((summary) => ({
        id: summary.clientMessageId,
        text: summary.text,
        ordinal: summary.ordinal,
        createdAt: summary.createdAt.toISOString(),
      })),
    };
  }

  async listMessages(userId: string, id: string, query: PageQuery) {
    await this.owned(this.prisma, userId, id);
    const limit = this.pageSize(query),
      cursor = this.cursor(query.cursor, 'messages', `${userId}:${id}`);
    if (
      cursor &&
      (!Number.isInteger(cursor.ordinal) || (cursor.ordinal as number) < 0)
    )
      throw new BadRequestException({
        error: { code: 'INVALID_CURSOR', message: '無效的訊息游標' },
      });
    const messages = await this.prisma.speakingMessage.findMany({
      where: {
        sessionId: id,
        ...(cursor ? { ordinal: { gt: cursor.ordinal as number } } : {}),
      },
      orderBy: { ordinal: 'asc' },
      take: limit + 1,
    });
    const hasMore = messages.length > limit,
      rows = messages.slice(0, limit),
      last = rows.at(-1);
    return {
      data: rows.map((row) => this.message(row)),
      meta: {
        hasMore,
        nextCursor:
          hasMore && last
            ? Buffer.from(
                JSON.stringify({
                  kind: 'messages',
                  owner: `${userId}:${id}`,
                  ordinal: last.ordinal,
                }),
              ).toString('base64url')
            : null,
      },
    };
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    await this.transaction(async (tx) => {
      await this.owned(tx, userId, id);
      await tx.speakingWriteReceipt.updateMany({
        where: { userId, sessionId: id },
        data: { deletedAt: new Date() },
      });
      await tx.speakingSession.delete({ where: { id } });
    });
  }

  private async words(tx: Db, userId: string): Promise<SpeakingContextWord[]> {
    return tx.targetVocabulary.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        term: true,
        zhMeaning: true,
        status: true,
        useCount: true,
        recommendationCount: true,
        expressionContext: true,
        naturalSentence: true,
        recommendationReason: true,
        addedCardId: true,
      },
    });
  }

  async getPracticeContext(userId: string): Promise<SpeakingPracticeContext> {
    return this.prisma.$transaction(
      async (tx) => {
        const targetVocabulary = await this.words(tx, userId);
        const latest = await tx.speakingSession.findFirst({
          where: {
            userId,
            endedAt: { not: null },
            OR: [
              { review: { isNot: null } },
              { legacySummaries: { some: {} } },
            ],
          },
          orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
          include,
        });
        const payload = latest?.review?.payload as unknown as
          | SpeakingRecordedResult
          | undefined;
        const legacy = latest?.legacyPracticeContext as unknown as
          | { plan: SpeakingPracticePlan }
          | undefined;
        const context: SpeakingPracticeContext = {
          schemaVersion: 1,
          userId,
          generatedAt: new Date().toISOString(),
          vocabularyVersion: digest(targetVocabulary),
          vocabularyCount: targetVocabulary.length,
          targetVocabulary,
          lastPractice: latest
            ? {
                sessionId: latest.id,
                source: latest.source,
                title: latest.title,
                summary: this.record(latest).summary ?? '',
                startedAt: latest.startedAt.toISOString(),
                endedAt: latest.endedAt!.toISOString(),
              }
            : null,
          nextPractice: payload?.nextPractice ?? legacy?.plan ?? null,
        };
        if (Buffer.byteLength(JSON.stringify(context)) > SPEAKING_MAX_BYTES)
          throw new UnprocessableEntityException({
            error: {
              code: 'CONTEXT_TOO_LARGE',
              message: '完整上下文超過大小限制，不會截斷資料',
            },
          });
        return context;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  allowedOrigins(): string[] {
    const configured = [
      this.config.get<string>('PUBLIC_API_ORIGIN'),
      this.config.get<string>('FRONTEND_URL'),
      ...(this.config.get<string>('CORS_ORIGINS') ?? '').split(','),
    ].filter(Boolean) as string[];
    if (this.config.get('NODE_ENV') !== 'production')
      configured.push('http://localhost:3280', 'http://localhost:4280');
    return configured.flatMap((value) => {
      try {
        return [new URL(value.trim()).origin];
      } catch {
        return [];
      }
    });
  }

  private async validation(
    tx: Db,
    userId: string,
    input: unknown,
  ): Promise<SpeakingReviewValidation> {
    const structural = validateStructure('SpeakingReviewDraft', input);
    if (structural.length)
      return {
        valid: false,
        contentHash: null,
        errors: structural,
        warnings: [],
      };
    const draft = input as SpeakingReviewDraft;
    const errors = validateReviewDraft(input, {
      userId,
      words: await this.words(tx, userId),
      apiOrigin: this.allowedOrigins().includes(draft.target.apiOrigin)
        ? draft.target.apiOrigin
        : 'unconfigured-origin',
    });
    if (draft.practice.source === 'APP' && draft.practice.sessionId) {
      const session = await this.owned(tx, userId, draft.practice.sessionId);
      const stored = await tx.speakingMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { ordinal: 'asc' },
      });
      if (
        session.source !== 'APP' ||
        session.sourceKey !== sourceKey(draft.practice.sourceRef) ||
        session.startedAt.getTime() !== Date.parse(draft.practice.startedAt) ||
        stored.length !== draft.practice.messages.length ||
        stored.some(
          (message, index) =>
            !this.sameMessage(
              this.message(message),
              draft.practice.messages[index],
            ),
        )
      ) {
        errors.push({
          path: '/practice',
          code: 'SESSION_MISMATCH',
          message: '草稿文字或來源與 App 已保存的場次不同',
        });
      }
    }
    return {
      valid: errors.length === 0,
      contentHash: digest(draft),
      errors,
      warnings: [],
    };
  }

  async validateReview(
    userId: string,
    input: unknown,
  ): Promise<SpeakingReviewValidation> {
    return this.validation(this.prisma, userId, input);
  }

  private saved(
    receipt: SpeakingWriteReceipt,
    status: SpeakingSavedReview['status'],
  ): SpeakingSavedReview {
    return {
      sessionId: receipt.sessionId,
      reviewId: receipt.reviewId!,
      status,
      actualUseCount: receipt.actualUseCount,
      recommendationCount: receipt.recommendationCount,
    };
  }

  async saveReview(
    userId: string,
    draft: SpeakingReviewDraft,
  ): Promise<SpeakingSavedReview> {
    this.check('SpeakingReviewDraft', draft);
    // 防誤送檢查必須在讀取原結果前執行。
    if (
      draft.target.userId !== userId ||
      !this.allowedOrigins().includes(draft.target.apiOrigin)
    )
      throw new UnprocessableEntityException({
        error: {
          code: 'REVIEW_TARGET_MISMATCH',
          message: '草稿帳號或環境與目前登入不同',
        },
      });
    return this.transaction(async (tx) => {
      const key = sourceKey(draft.practice.sourceRef),
        hash = digest(draft);
      const where = {
        userId_source_sourceKey: {
          userId,
          source: draft.practice.source,
          sourceKey: key,
        },
      };
      const receipt = await tx.speakingWriteReceipt.findUnique({ where });
      if (receipt?.deletedAt)
        throw conflict('這場歷史已刪除，不能以重試重新建立');
      if (receipt?.reviewId) {
        if (receipt.reviewContentHash !== hash) throw conflict();
        return this.saved(receipt, 'alreadySaved');
      }
      const validation = await this.validation(tx, userId, draft);
      if (!validation.valid)
        throw new UnprocessableEntityException({
          error: {
            code: 'REVIEW_INVALID',
            message: 'Review 驗證不符',
            details: validation.errors,
          },
        });
      let sessionId: string;
      if (draft.practice.source === 'APP') {
        const session = await this.owned(tx, userId, draft.practice.sessionId!);
        if (session.review || session.legacySummaries.length)
          throw conflict('原紀錄已整理，請建立新練習');
        sessionId = session.id;
      } else {
        if (receipt) throw conflict();
        const session = await tx.speakingSession.create({
          data: {
            userId,
            source: 'LOCAL',
            sourceKey: key,
            clientSessionId: draft.practice.sourceRef.conversationId,
            title: draft.practice.title,
            startedAt: new Date(draft.practice.startedAt),
            endedAt: new Date(draft.practice.endedAt),
            messages: {
              create: draft.practice.messages.map((message, index) =>
                this.messageData(message, index),
              ),
            },
          },
        });
        sessionId = session.id;
      }
      const review = await tx.speakingReview.create({
        data: {
          sessionId,
          schemaVersion: 1,
          contentHash: hash,
          summary: draft.result.summary,
          payload: json(draft.result),
        },
      });
      const practicedAt = new Date(draft.practice.endedAt);
      const events = [
        ...draft.result.actualUses.map((entry) => ({
          ...entry,
          type: 'actual-use',
        })),
        ...draft.result.recommendations.map((entry) => ({
          ...entry,
          type: 'recommendation',
        })),
      ];
      if (events.length)
        await tx.speakingReviewEvent.createMany({
          data: events.map((event) => ({
            reviewId: review.id,
            targetVocabularyId: event.targetVocabularyId,
            type: event.type,
            practicedAt,
            payload: json(event),
          })),
        });
      await this.vocabulary.applyRecordedReview(
        tx,
        userId,
        draft.result,
        practicedAt,
      );
      await tx.speakingSession.update({
        where: { id: sessionId },
        data: {
          title: draft.practice.title,
          endedAt: practicedAt,
          revision: { increment: 1 },
        },
      });
      const data = {
        reviewId: review.id,
        reviewContentHash: hash,
        actualUseCount: draft.result.actualUses.length,
        recommendationCount: draft.result.recommendations.length,
      };
      const saved = receipt
        ? await tx.speakingWriteReceipt.update({ where, data })
        : await tx.speakingWriteReceipt.create({
            data: {
              ...data,
              userId,
              source: draft.practice.source,
              sourceKey: key,
              sessionId,
            },
          });
      return this.saved(saved, 'saved');
    });
  }

  async migrateHistory(
    userId: string,
    input: SpeakingHistoryMigration,
  ): Promise<SpeakingMigrationResult[]> {
    this.check('SpeakingHistoryMigration', input);
    this.checkExpectedAccount(userId, input.expectedUserId);
    const results: SpeakingMigrationResult[] = [];
    for (const item of input.sessions) {
      try {
        results.push(
          await this.transaction((tx) => this.migrateOne(tx, userId, item)),
        );
      } catch (error) {
        results.push({
          clientSessionId: item.clientSessionId,
          sessionId: null,
          status: error instanceof ConflictException ? 'conflict' : 'failed',
          message:
            error instanceof ConflictException ||
            error instanceof BadRequestException
              ? error.message
              : '搬移未完成，原資料保留，請稍後重試',
        });
      }
    }
    return results;
  }

  private async migrateOne(
    tx: Db,
    userId: string,
    item: SpeakingLegacySession,
  ): Promise<SpeakingMigrationResult> {
    const key = sourceKey(appRef(item.clientSessionId)),
      hash = digest(item);
    const where = {
      userId_source_sourceKey: {
        userId,
        source: 'APP' as const,
        sourceKey: key,
      },
    };
    const receipt = await tx.speakingWriteReceipt.findUnique({ where });
    if (receipt) {
      if (receipt.deletedAt || receipt.initialContentHash !== hash)
        throw conflict();
      return {
        clientSessionId: item.clientSessionId,
        sessionId: receipt.sessionId,
        status: 'alreadyImported',
        message: null,
      };
    }
    let previous = Date.parse(item.startedAt);
    const end = Date.parse(item.endedAt),
      ids = new Set<string>();
    if (end < previous) throw new BadRequestException('場次時間倒序');
    for (const message of item.messages) {
      const time = Date.parse(message.createdAt);
      if (
        ids.has(message.id) ||
        time < previous ||
        time > end ||
        (!message.text.trim() && message.transcriptStatus !== 'unavailable')
      )
        throw new BadRequestException('舊訊息識別、時間或逐字稿狀態錯誤');
      ids.add(message.id);
      previous = time;
    }
    const summaryIds = new Set<string>();
    for (const summary of item.summaries) {
      if (
        ids.has(summary.id) ||
        summaryIds.has(summary.id) ||
        Date.parse(summary.createdAt) < Date.parse(item.startedAt) ||
        Date.parse(summary.createdAt) > end
      )
        throw new BadRequestException('舊摘要識別或時間錯誤');
      summaryIds.add(summary.id);
    }
    if (
      item.legacyPracticeContext &&
      !summaryIds.has(item.legacyPracticeContext.summaryId)
    )
      throw new BadRequestException('下次計畫無法對應到舊摘要');
    const session = await tx.speakingSession.create({
      data: {
        userId,
        source: 'APP',
        sourceKey: key,
        clientSessionId: item.clientSessionId,
        title: item.title,
        startedAt: new Date(item.startedAt),
        endedAt: new Date(item.endedAt),
        ...(item.legacyPracticeContext
          ? { legacyPracticeContext: json(item.legacyPracticeContext) }
          : {}),
        messages: {
          create: item.messages.map((message, index) =>
            this.messageData(message, index),
          ),
        },
        legacySummaries: {
          create: item.summaries.map((summary) => ({
            clientMessageId: summary.id,
            text: summary.text,
            createdAt: new Date(summary.createdAt),
            ordinal: summary.ordinal,
          })),
        },
      },
    });
    await tx.speakingWriteReceipt.create({
      data: {
        userId,
        source: 'APP',
        sourceKey: key,
        sessionId: session.id,
        initialContentHash: hash,
      },
    });
    return {
      clientSessionId: item.clientSessionId,
      sessionId: session.id,
      status: 'imported',
      message: null,
    };
  }
}
