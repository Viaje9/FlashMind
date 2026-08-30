import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SpeakingReviewDraft } from '@flashmind/shared';
import { SpeakingHistoryService } from './speaking-history.service';
import { TargetVocabularyService } from '../target-vocabulary/target-vocabulary.service';

const url = process.env.DATABASE_URL;
const isolated =
  url && new URL(url).searchParams.get('schema') === 'speaking_cli_test';
(isolated ? describe : describe.skip)(
  'SpeakingHistoryService（隔離 PostgreSQL）',
  () => {
    let db: PrismaClient;
    let service: SpeakingHistoryService;
    let vocabulary: TargetVocabularyService;
    let userId: string;
    let wordId: string;
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          '../../packages/shared/test/review.fixture.json',
        ),
        'utf8',
      ),
    );
    function draft(): SpeakingReviewDraft {
      const value = structuredClone(fixture) as SpeakingReviewDraft;
      value.target.userId = userId;
      value.practice.sourceRef.sessionKey = randomUUID();
      value.result.actualUses[0].targetVocabularyId = wordId;
      value.result.deckCandidates = [wordId];
      return value;
    }
    beforeAll(async () => {
      if (!isolated) throw new Error('拒絕在非測試 schema 執行');
      db = new PrismaClient({
        adapter: new PrismaPg(
          { connectionString: url },
          { schema: 'speaking_cli_test' },
        ),
      });
      await db.$connect();
      vocabulary = new TargetVocabularyService(db as never);
      service = new SpeakingHistoryService(
        db as never,
        new ConfigService({ PUBLIC_API_ORIGIN: 'https://flashmind.example' }),
        vocabulary,
      );
    });
    beforeEach(async () => {
      const user = await db.user.create({
        data: { email: `speaking-test-${randomUUID()}@example.invalid` },
      });
      userId = user.id;
      const word = await db.targetVocabulary.create({
        data: {
          userId,
          term: 'walk',
          normalizedTerm: 'walk',
          zhMeaning: '散步',
        },
      });
      wordId = word.id;
    });
    afterEach(async () => {
      jest.restoreAllMocks();
      if (userId) await db.user.delete({ where: { id: userId } });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('validate 回傳證據檢查且完全不寫入學習資料', async () => {
      const value = draft();
      expect((await service.validateReview(userId, value)).valid).toBe(true);
      expect(await db.speakingSession.count({ where: { userId } })).toBe(0);
      expect(
        (await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }))
          .useCount,
      ).toBe(0);
      value.result.actualUses[0].evidence[0].messageId = 'a1';
      expect((await service.validateReview(userId, value)).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'EVIDENCE_INVALID' }),
        ]),
      );
    });
    it('原子保存完整對話與 Review，相同內容並行重送只計一次', async () => {
      const value = draft();
      const results = await Promise.all([
        service.saveReview(userId, value),
        service.saveReview(userId, value),
      ]);
      expect(results[0].sessionId).toBe(results[1].sessionId);
      const detail = await service.getSession(userId, results[0].sessionId);
      expect(detail.session.source).toBe('LOCAL');
      expect(detail.review).toEqual(value.result);
      expect(
        (await service.listMessages(userId, results[0].sessionId, {})).data,
      ).toHaveLength(2);
      expect(
        await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }),
      ).toMatchObject({ status: 'USED', useCount: 1 });
      expect(await db.card.count({ where: { deck: { userId } } })).toBe(0);
      await db.targetVocabulary.update({
        where: { id: wordId },
        data: { status: 'ADDED' },
      });
      expect((await service.saveReview(userId, value)).status).toBe(
        'alreadySaved',
      );
      expect(
        (await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }))
          .useCount,
      ).toBe(1);
    });
    it('同識別不同內容回傳 409，不覆寫確認結果', async () => {
      const value = draft();
      const saved = await service.saveReview(userId, value);
      value.result.review = '不同內容';
      await expect(service.saveReview(userId, value)).rejects.toMatchObject({
        status: 409,
      });
      expect(
        (await service.getSession(userId, saved.sessionId)).review?.review,
      ).not.toBe('不同內容');
    });
    it('單字寫入失敗時場次、Review、receipt 全部回滾', async () => {
      jest
        .spyOn(vocabulary, 'applyRecordedReview')
        .mockRejectedValueOnce(new Error('模擬資料庫失敗'));
      await expect(service.saveReview(userId, draft())).rejects.toThrow(
        '模擬資料庫失敗',
      );
      expect(await db.speakingSession.count({ where: { userId } })).toBe(0);
      expect(await db.speakingWriteReceipt.count({ where: { userId } })).toBe(
        0,
      );
    });
    it('context 包含全部四種狀態且空歷史不偽造計畫', async () => {
      for (const status of ['PRACTICING', 'USED', 'ADDED'] as const)
        await db.targetVocabulary.create({
          data: {
            userId,
            term: status,
            normalizedTerm: status.toLowerCase(),
            zhMeaning: '測試',
            status,
          },
        });
      const context = await service.getPracticeContext(userId);
      expect(context.vocabularyCount).toBe(4);
      expect(context.targetVocabulary.map((w) => w.status).sort()).toEqual([
        'ADDED',
        'PRACTICING',
        'UNSEEN',
        'USED',
      ]);
      expect(context.lastPractice).toBeNull();
      expect(context.nextPractice).toBeNull();
    });
    it('補匯入舊場次不覆蓋最新計畫與例句，累積使用保留', async () => {
      const latest = draft();
      await service.saveReview(userId, latest);
      const older = draft();
      older.practice.startedAt = '2026-08-29T10:00:00+08:00';
      older.practice.endedAt = '2026-08-29T10:10:00+08:00';
      older.practice.messages.forEach(
        (m) => (m.createdAt = m.createdAt.replace('2026-08-30', '2026-08-29')),
      );
      older.result.nextPractice.topic = 'Old topic';
      older.result.actualUses[0].naturalSentence = 'I walk every day.';
      await service.saveReview(userId, older);
      expect(
        (await service.getPracticeContext(userId)).nextPractice?.topic,
      ).toBe(latest.result.nextPractice.topic);
      expect(
        await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }),
      ).toMatchObject({
        useCount: 2,
        naturalSentence: latest.result.actualUses[0].naturalSentence,
      });
    });
    it('App 未整理時保存訊息，重送不重複並拒絕舊 revision 新內容', async () => {
      const value = draft();
      const input = {
        expectedUserId: userId,
        clientSessionId: randomUUID(),
        title: 'App 練習',
        startedAt: value.practice.startedAt,
      };
      const session = await service.createSession(userId, input);
      expect((await service.createSession(userId, input)).id).toBe(session.id);
      const payload = {
        expectedUserId: userId,
        revision: 0,
        messages: value.practice.messages,
      };
      await service.appendMessages(userId, session.id, payload);
      await service.appendMessages(userId, session.id, payload);
      expect(
        (await service.listMessages(userId, session.id, {})).data,
      ).toHaveLength(2);
      await expect(
        service.appendMessages(userId, session.id, {
          expectedUserId: userId,
          revision: 0,
          messages: [{ ...value.practice.messages[1], id: 'new' }],
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.getSession('someone-else', session.id),
      ).rejects.toMatchObject({ status: 404 });
      const first = await service.listMessages(userId, session.id, {
        limit: 1,
      });
      expect(first.meta.hasMore).toBe(true);
      expect(
        (
          await service.listMessages(userId, session.id, {
            limit: 1,
            cursor: first.meta.nextCursor!,
          })
        ).data[0].id,
      ).toBe('a1');
    });
    it('搬移多個舊 Summary 與缺字音訊，重試不分析或計次', async () => {
      const value = draft();
      const item = {
        clientSessionId: randomUUID(),
        title: '舊紀錄',
        startedAt: value.practice.startedAt,
        endedAt: value.practice.endedAt,
        messages: [
          {
            ...value.practice.messages[0],
            text: '',
            transcriptStatus: 'unavailable' as const,
            hasOriginalAudio: true,
          },
        ],
        summaries: [
          {
            id: 's1',
            text: '原有文字摘要',
            createdAt: value.practice.endedAt,
            ordinal: 1,
          },
          {
            id: 's2',
            text: '另一份摘要',
            createdAt: value.practice.endedAt,
            ordinal: 2,
          },
        ],
      };
      const first = await service.migrateHistory(userId, {
        expectedUserId: userId,
        sessions: [item],
      });
      expect(first[0].status).toBe('imported');
      expect(
        (
          await service.migrateHistory(userId, {
            expectedUserId: userId,
            sessions: [item],
          })
        )[0].status,
      ).toBe('alreadyImported');
      expect(
        (await service.getSession(userId, first[0].sessionId!)).legacySummaries,
      ).toHaveLength(2);
      expect(
        (await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }))
          .useCount,
      ).toBe(0);
      expect(
        (
          await service.migrateHistory(userId, {
            expectedUserId: userId,
            sessions: [{ ...item, title: '改過' }],
          })
        )[0].status,
      ).toBe('conflict');
    });
    it('刪除文字與 Review 後保留次數及防重，context 不再引用', async () => {
      const value = draft();
      const saved = await service.saveReview(userId, value);
      await service.deleteSession(userId, saved.sessionId);
      await expect(
        service.getSession(userId, saved.sessionId),
      ).rejects.toMatchObject({ status: 404 });
      await expect(service.saveReview(userId, value)).rejects.toMatchObject({
        status: 409,
      });
      expect(
        (await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }))
          .useCount,
      ).toBe(1);
      expect(
        (await service.getPracticeContext(userId)).lastPractice,
      ).toBeNull();
    });
    it('空字表完整回傳，無 AI 或寫入；帳號環境及未知資源拒絕', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('此流程不可呼叫 AI'));
      await db.targetVocabulary.delete({ where: { id: wordId } });
      const context = await service.getPracticeContext(userId);
      expect(context).toMatchObject({
        vocabularyCount: 0,
        targetVocabulary: [],
        lastPractice: null,
        nextPractice: null,
      });
      const value = draft();
      expect((await service.validateReview(userId, value)).valid).toBe(false);
      value.target.userId = 'other-user';
      await expect(service.saveReview(userId, value)).rejects.toMatchObject({
        status: 422,
      });
      value.target.userId = userId;
      value.target.apiOrigin = 'https://wrong.example';
      await expect(service.saveReview(userId, value)).rejects.toMatchObject({
        status: 422,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await db.speakingSession.count({ where: { userId } })).toBe(0);
    });
    it('較新 App 計畫取代 LOCAL，刪除後回退；歷史游標不跨帳號', async () => {
      const older = draft();
      const first = await service.saveReview(userId, older);
      const app = draft();
      app.practice.messages.forEach(
        (message) =>
          (message.createdAt = message.createdAt.replace(
            '2026-08-30',
            '2026-08-31',
          )),
      );
      app.practice.startedAt = app.practice.startedAt.replace(
        '2026-08-30',
        '2026-08-31',
      );
      app.practice.endedAt = app.practice.endedAt.replace(
        '2026-08-30',
        '2026-08-31',
      );
      const clientSessionId = randomUUID();
      const created = await service.createSession(userId, {
        expectedUserId: userId,
        clientSessionId,
        title: '新 App',
        startedAt: app.practice.startedAt,
      });
      await service.appendMessages(userId, created.id, {
        expectedUserId: userId,
        revision: 0,
        messages: app.practice.messages,
        endedAt: app.practice.endedAt,
      });
      app.practice.source = 'APP';
      app.practice.sessionId = created.id;
      app.practice.sourceRef = {
        system: 'flashmind',
        conversationId: clientSessionId,
        sessionKey: 'app',
      };
      app.result.nextPractice.topic = 'New App topic';
      const wrong = structuredClone(app);
      wrong.practice.messages[0].text = 'changed';
      expect((await service.validateReview(userId, wrong)).valid).toBe(false);
      jest
        .spyOn(vocabulary, 'applyRecordedReview')
        .mockRejectedValueOnce(new Error('途中失敗'));
      await expect(service.saveReview(userId, app)).rejects.toThrow('途中失敗');
      expect(
        (await service.listMessages(userId, created.id, {})).data[0].text,
      ).toBe(app.practice.messages[0].text);
      expect((await service.getSession(userId, created.id)).review).toBeNull();
      await service.saveReview(userId, app);
      expect(
        (await service.getPracticeContext(userId)).lastPractice?.source,
      ).toBe('APP');
      const page = await service.listSessions(userId, { limit: 1 });
      expect(page.data[0].id).toBe(created.id);
      expect(
        (
          await service.listSessions(userId, {
            limit: 1,
            cursor: page.meta.nextCursor!,
          })
        ).data[0].id,
      ).toBe(first.sessionId);
      await expect(
        service.listSessions('other-user', { cursor: page.meta.nextCursor! }),
      ).rejects.toMatchObject({ status: 400 });
      await service.deleteSession(userId, created.id);
      expect((await service.getPracticeContext(userId)).nextPractice).toEqual(
        older.result.nextPractice,
      );
    });
    it('legacy 計畫必須指向確實存在的 Summary，已刪除不被搬移復活', async () => {
      const value = draft();
      const item = {
        clientSessionId: randomUUID(),
        title: '舊文字',
        startedAt: value.practice.startedAt,
        endedAt: value.practice.endedAt,
        messages: [],
        summaries: [
          {
            id: 'legacy-summary',
            text: '舊摘要',
            createdAt: value.practice.endedAt,
            ordinal: 0,
          },
        ],
        legacyPracticeContext: {
          summaryId: 'not-found',
          plan: value.result.nextPractice,
        },
      };
      expect(
        (
          await service.migrateHistory(userId, {
            expectedUserId: userId,
            sessions: [item],
          })
        )[0].status,
      ).toBe('failed');
      item.legacyPracticeContext.summaryId = 'legacy-summary';
      const result = (
        await service.migrateHistory(userId, {
          expectedUserId: userId,
          sessions: [item],
        })
      )[0];
      expect(result.status).toBe('imported');
      expect((await service.getPracticeContext(userId)).nextPractice).toEqual(
        value.result.nextPractice,
      );
      await service.deleteSession(userId, result.sessionId!);
      expect(
        (
          await service.migrateHistory(userId, {
            expectedUserId: userId,
            sessions: [item],
          })
        )[0].status,
      ).toBe('conflict');
      expect(
        (await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }))
          .recommendationCount,
      ).toBe(0);
    });
    it('同字的實際使用與推薦各計一次，不降級已加入且不建立卡片', async () => {
      const value = draft();
      const use = value.result.actualUses[0];
      value.result.recommendations = [
        {
          targetVocabularyId: wordId,
          term: use.term,
          expressionContext: use.expressionContext,
          naturalSentence: use.naturalSentence,
          recommendationReason: '下次延續',
        },
      ];
      await db.targetVocabulary.update({
        where: { id: wordId },
        data: { status: 'ADDED' },
      });
      const beforeCards = await db.card.count({ where: { deck: { userId } } });
      await service.saveReview(userId, value);
      await service.saveReview(userId, value);
      expect(
        await db.targetVocabulary.findUniqueOrThrow({ where: { id: wordId } }),
      ).toMatchObject({ status: 'ADDED', useCount: 1, recommendationCount: 1 });
      expect(await db.card.count({ where: { deck: { userId } } })).toBe(
        beforeCards,
      );
    });

    it('瀏覽器 cookie 換成另一個帳號時拒絕舊分頁寫入', async () => {
      const input = {
        expectedUserId: 'stale-account',
        clientSessionId: randomUUID(),
        title: '舊分頁',
        startedAt: new Date().toISOString(),
      };
      await expect(service.createSession(userId, input)).rejects.toMatchObject({
        status: 403,
      });
      expect(await db.speakingSession.count({ where: { userId } })).toBe(0);
    });
  },
);
