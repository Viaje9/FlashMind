import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Configuration,
  SpeakingHistoryService,
  type SpeakingSummaryResult,
} from '@flashmind/api-client';
import type {
  SpeakingHistoryMessage,
  SpeakingPracticeContext,
  SpeakingSessionRecord,
} from '@flashmind/shared';
import { AuthService } from '../../services/auth.service';
import { SpeakingLocalRepository } from './speaking-local.repository';
import {
  createConversationRecord,
  formatSpeakingReviewSummary,
  type SpeakingConversation,
  type SpeakingMessage,
  type SpeakingSettings,
} from './speaking.domain';
import { createAppReviewDraft, toCloudMessages } from './speaking-history.domain';

@Injectable({ providedIn: 'root' })
export class SpeakingRepository {
  private readonly local = inject(SpeakingLocalRepository);
  private readonly api = inject(SpeakingHistoryService);
  private readonly auth = inject(AuthService);
  private readonly config = inject(Configuration);
  private readonly queues = new Map<string, Promise<boolean>>();
  private context: SpeakingPracticeContext | null = null;
  private readonly syncState = signal<{ owner: string; message: string } | null>(null);
  readonly ownerId = computed(() => this.auth.user()?.id ?? null);
  readonly syncError = computed(() =>
    this.syncState()?.owner === this.ownerId() ? (this.syncState()?.message ?? null) : null,
  );

  private owner(): string {
    const id = this.ownerId();
    if (!id) throw new Error('請先登入');
    return id;
  }
  private assertOwner(owner: string) {
    if (this.ownerId() !== owner) throw new Error('登入帳號已變更，原帳號資料保留待同步');
  }
  private async patch(id: string, data: Partial<SpeakingConversation>) {
    const record = await this.local.getConversation(id);
    if (!record) throw new Error('本機場次不存在');
    await this.local.saveConversation({ ...record.conversation, ...data });
  }
  async beginConversation(id: string) {
    const ownerId = this.owner();
    const existing = await this.local.getConversation(id);
    if (existing) {
      if (existing.conversation.ownerId !== ownerId)
        throw new Error('不可認領其他帳號或未搬移的紀錄');
      return;
    }
    await this.local.saveConversation({
      ...createConversationRecord({ id }),
      ownerId,
      source: 'APP',
      reviewed: false,
      syncPending: false,
    });
  }
  async getConversation(
    id: string,
  ): Promise<{ conversation: SpeakingConversation; messages: SpeakingMessage[] } | null> {
    const cached = await this.local.getConversation(id);
    if (cached) return cached.conversation.ownerId === this.owner() ? cached : null;
    const pending = (await this.local.listConversations()).find(
      (record) =>
        record.ownerId === this.owner() &&
        record.remoteId === id &&
        (record.syncPending || record.pendingReview),
    );
    if (pending) return this.local.getConversation(pending.id);
    return this.getRemoteConversation(id);
  }
  async saveMessage(message: SpeakingMessage): Promise<void> {
    const record = await this.local.getConversation(message.conversationId);
    if (!record || record.conversation.ownerId !== this.owner())
      throw new Error('訊息不屬於目前帳號的練習');
    await this.local.saveMessage(message);
  }
  async saveMessages(messages: SpeakingMessage[]) {
    for (const message of messages) await this.saveMessage(message);
  }
  async saveConversation(conversation: SpeakingConversation): Promise<void> {
    const existing = await this.local.getConversation(conversation.id);
    if (!existing || existing.conversation.ownerId !== this.owner())
      throw new Error('場次不屬於目前帳號');
    // 本機的同步 metadata 不可被較早的 UI 快照蓋回去。
    await this.patch(conversation.id, {
      title: conversation.title,
      summary: conversation.summary,
      messageCount: conversation.messageCount,
      updatedAt: conversation.updatedAt,
      lastMessageText: conversation.lastMessageText,
    });
    if (!existing.conversation.reviewed) await this.syncConversation(conversation.id);
  }
  async syncConversation(id: string): Promise<boolean> {
    const owner = this.owner();
    const pending = (this.queues.get(id) ?? Promise.resolve(true)).then(() =>
      this.flush(id, owner),
    );
    this.queues.set(id, pending);
    try {
      return await pending;
    } finally {
      if (this.queues.get(id) === pending) this.queues.delete(id);
    }
  }
  private async flush(id: string, owner: string): Promise<boolean> {
    try {
      this.assertOwner(owner);
      const record = await this.local.getConversation(id);
      if (!record || record.conversation.ownerId !== owner) return false;
      if (record.conversation.reviewed) return true;
      const messages = toCloudMessages(record.messages);
      if (!messages.length) return true;
      await this.patch(id, { syncPending: true });
      let conversation = record.conversation;
      if (!conversation.remoteId) {
        const input = conversation.remoteCreate ?? {
          expectedUserId: owner,
          clientSessionId: id,
          title: conversation.title,
          startedAt: new Date(
            Math.min(Date.parse(conversation.createdAt), Date.parse(messages[0].createdAt)),
          ).toISOString(),
        };
        await this.patch(id, { remoteCreate: input });
        this.assertOwner(owner);
        const { data } = await firstValueFrom(this.api.createSpeakingSession(input));
        await this.patch(id, { remoteId: data.id, remoteRevision: data.revision });
        conversation = { ...conversation, remoteId: data.id, remoteRevision: data.revision };
      }
      this.assertOwner(owner);
      const sent = new Set(conversation.syncedMessageIds ?? []);
      const fresh = messages.filter((message) => !sent.has(message.id));
      if (fresh.length) {
        const { data } = await firstValueFrom(
          this.api.appendSpeakingMessages(conversation.remoteId!, {
            expectedUserId: owner,
            revision: conversation.remoteRevision ?? 0,
            messages: fresh,
            endedAt: messages.at(-1)!.createdAt,
          }),
        );
        fresh.forEach((message) => sent.add(message.id));
        await this.patch(id, {
          remoteRevision: data.revision,
          syncedMessageIds: [...sent],
          syncPending: false,
        });
      } else await this.patch(id, { syncPending: false });
      this.syncState.set(null);
      return true;
    } catch {
      this.syncState.set({
        owner,
        message: '文字尚未同步，原文與音訊仍保留在本機。請確認網路後重試。',
      });
      return false;
    }
  }
  async requireSync(id: string) {
    if (!(await this.syncConversation(id))) throw new Error('文字尚未同步，請重試保存');
  }
  async pendingCount() {
    return (await this.local.listConversations()).filter(
      (record) => record.ownerId === this.owner() && record.syncPending,
    ).length;
  }
  async retryPending() {
    const owner = this.owner();
    for (const record of await this.local.listConversations())
      if (record.ownerId === owner && record.syncPending) await this.syncConversation(record.id);
  }
  async refreshPracticeContext(): Promise<SpeakingPracticeContext> {
    const owner = this.owner();
    this.context = null;
    const { data } = await firstValueFrom(this.api.getSpeakingPracticeContext());
    this.assertOwner(owner);
    if (data.userId !== owner || data.targetVocabulary.length !== data.vocabularyCount)
      throw new Error('練習上下文不完整');
    this.context = data;
    return data;
  }
  loadSettings(): SpeakingSettings {
    const local = this.local.loadSettings();
    const context = this.context?.userId === this.ownerId() ? this.context : null;
    return {
      ...local,
      lastPractice: context?.lastPractice
        ? { title: context.lastPractice.title, summary: context.lastPractice.summary }
        : undefined,
      nextPractice: context?.nextPractice ?? undefined,
    };
  }
  saveSettings(settings: SpeakingSettings) {
    // 裝置設定留本機；舊 lastPractice／nextPractice 保留供明確搬移，不再作為 Practice 的來源。
    const old = this.local.loadSettings();
    this.local.saveSettings({
      ...settings,
      lastPractice: old.lastPractice,
      nextPractice: old.nextPractice,
    });
  }
  async pendingAnalysis(id: string): Promise<SpeakingSummaryResult | undefined> {
    return (await this.getConversation(id))?.conversation.pendingAnalysis;
  }
  async saveAnalysis(id: string, analysis: SpeakingSummaryResult): Promise<void> {
    const owner = this.owner();
    const initial = await this.local.getConversation(id);
    if (!initial || initial.conversation.ownerId !== owner) throw new Error('場次帳號不同');
    await this.patch(id, { pendingAnalysis: analysis });
    await this.requireSync(id);
    const record = (await this.local.getConversation(id))!;
    let draft = record.conversation.pendingReview;
    if (!draft) {
      const context = await this.refreshPracticeContext();
      this.assertOwner(owner);
      const { data } = await firstValueFrom(
        this.api.getSpeakingSession(record.conversation.remoteId!),
      );
      const messages = await this.remoteMessages(data.session.id, owner);
      draft = createAppReviewDraft({
        origin: new URL(this.config.basePath || '/api', window.location.origin).origin,
        context,
        session: data.session,
        messages,
        analysis,
      });
      await this.patch(id, { pendingReview: draft });
    }
    this.assertOwner(owner);
    const validation = await firstValueFrom(this.api.validateSpeakingReview(draft));
    if (!validation.data.valid) throw new Error('Review 證據驗證失敗，分析結果保留在本機');
    this.assertOwner(owner);
    await firstValueFrom(this.api.saveSpeakingReview(draft));
    await this.patch(id, {
      pendingAnalysis: undefined,
      pendingReview: undefined,
      reviewed: true,
      review: draft.result,
      title: draft.practice.title,
      summary: draft.result.summary,
      syncPending: false,
    });
    try {
      await this.refreshPracticeContext();
    } catch {
      /* 保存已成功，下次開始時會重新取得 context。 */
    }
  }
  continueFrom(conversation: SpeakingConversation) {
    if (this.context?.userId !== this.owner()) return;
    this.context = {
      ...this.context,
      lastPractice: {
        sessionId: conversation.remoteId ?? conversation.id,
        source: conversation.source ?? 'APP',
        title: conversation.title,
        summary: conversation.summary ?? '',
        startedAt: conversation.createdAt,
        endedAt: conversation.updatedAt,
      },
      nextPractice: conversation.review?.nextPractice ?? null,
    };
  }
  async listConversationPage(cursor?: string) {
    const owner = this.owner();
    const { data, meta } = await firstValueFrom(this.api.listSpeakingSessions(cursor, 30));
    this.assertOwner(owner);
    return { data: data.map((session) => this.fromRemote(session, owner)), meta };
  }
  async listConversations(): Promise<SpeakingConversation[]> {
    const result: SpeakingConversation[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.listConversationPage(cursor);
      result.push(...page.data);
      cursor = page.meta.hasMore ? (page.meta.nextCursor ?? undefined) : undefined;
    } while (cursor);
    return result;
  }
  private fromRemote(session: SpeakingSessionRecord, owner: string): SpeakingConversation {
    return {
      id: session.id,
      ownerId: owner,
      remoteId: session.id,
      remoteRevision: session.revision,
      source: session.source,
      reviewed: session.reviewed,
      title: session.title,
      summary: session.summary ?? undefined,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.startedAt,
      updatedAt: session.endedAt ?? session.updatedAt,
      messageCount: session.messageCount,
    };
  }
  private async remoteMessages(id: string, owner: string): Promise<SpeakingHistoryMessage[]> {
    const messages: SpeakingHistoryMessage[] = [];
    let cursor: string | undefined;
    do {
      this.assertOwner(owner);
      const { data, meta } = await firstValueFrom(this.api.listSpeakingMessages(id, cursor, 100));
      messages.push(...data);
      cursor = meta.hasMore ? (meta.nextCursor ?? undefined) : undefined;
    } while (cursor);
    this.assertOwner(owner);
    return messages;
  }
  async getRemoteConversation(
    id: string,
  ): Promise<{ conversation: SpeakingConversation; messages: SpeakingMessage[] }> {
    const owner = this.owner();
    const { data } = await firstValueFrom(this.api.getSpeakingSession(id));
    const originals = await this.remoteMessages(id, owner);
    const localRecord = (await this.local.listConversations()).find(
      (record) =>
        (record.ownerId === owner && record.remoteId === id) || record.migratedTo?.[owner] === id,
    );
    const localMessages = localRecord ? await this.local.listMessages(localRecord.id) : [];
    const messages: SpeakingMessage[] = [];
    for (const message of originals) {
      const local = localMessages.find((item) => item.id === message.id);
      const audioBlobKey =
        local?.audioBlobKey && (await this.local.getAudioBlob(local.audioBlobKey))
          ? local.audioBlobKey
          : undefined;
      messages.push({
        ...message,
        conversationId: data.session.clientSessionId,
        audioBlobKey,
        audioMimeType: local?.audioMimeType,
        translatedText: local?.translatedText ?? message.translatedText,
      });
    }
    const conversation = {
      ...this.fromRemote(data.session, owner),
      review: data.review ?? undefined,
    };
    for (const summary of data.legacySummaries)
      messages.splice(Math.min(summary.ordinal, messages.length), 0, {
        id: summary.id,
        conversationId: data.session.clientSessionId,
        role: 'summary',
        text: summary.text,
        createdAt: summary.createdAt,
      });
    if (data.review)
      messages.push({
        id: `review:${id}`,
        conversationId: data.session.clientSessionId,
        role: 'summary',
        createdAt: data.session.endedAt!,
        text: formatSpeakingReviewSummary({
          ...data.review,
          actualUses: data.review.actualUses.map((item) => ({ ...item, zhMeaning: '' })),
          recommendations: data.review.recommendations.map((item) => ({ ...item, zhMeaning: '' })),
        }),
      });
    this.assertOwner(owner);
    // 未整理 APP 可在別的裝置接續；建立帳號範圍快取，原始訊息 ID 不變。
    if (
      data.session.source === 'APP' &&
      !data.session.reviewed &&
      !localRecord?.syncPending &&
      !localRecord?.pendingReview
    ) {
      const cacheId = localRecord?.ownerId === owner ? localRecord.id : `${owner}:${id}`;
      const cachedConversation = {
        ...conversation,
        id: cacheId,
        syncedMessageIds: originals.map((message) => message.id),
      };
      messages.forEach((message) => {
        message.conversationId = cacheId;
      });
      await this.local.saveConversation(cachedConversation);
      await this.local.saveMessages(messages);
      return { conversation: cachedConversation, messages };
    }
    return { conversation, messages };
  }
  async deleteConversation(id: string) {
    const owner = this.owner();
    await firstValueFrom(this.api.deleteSpeakingSession(id));
    for (const record of await this.local.listConversations()) {
      if (record.ownerId === owner && record.remoteId === id)
        await this.local.deleteConversation(record.id);
    }
  }
  saveAudioBlob(input: Parameters<SpeakingLocalRepository['saveAudioBlob']>[0]) {
    return this.local.saveAudioBlob(input);
  }
  getAudioBlob(key: string) {
    return this.local.getAudioBlob(key);
  }
  getAudioBase64(key: string) {
    return this.local.getAudioBase64(key);
  }
  enforceConversationStorageLimit(limit: number, protectedId?: string) {
    return this.local.enforceConversationStorageLimit(limit, protectedId);
  }
}
