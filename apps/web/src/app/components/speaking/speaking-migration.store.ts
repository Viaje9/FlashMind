import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SpeakingHistoryService } from '@flashmind/api-client';
import type { SpeakingLegacySession, SpeakingMigrationResult } from '@flashmind/shared';
import { AuthService } from '../../services/auth.service';
import { SpeakingLocalRepository } from './speaking-local.repository';
import { toLegacySession } from './speaking-history.domain';
import { type SpeakingConversation } from './speaking.domain';

@Injectable({ providedIn: 'root' })
export class SpeakingMigrationStore {
  private readonly local = inject(SpeakingLocalRepository);
  private readonly api = inject(SpeakingHistoryService);
  private readonly auth = inject(AuthService);
  private scannedOwner: string | null = null;
  private confirmedOwner: string | null = null;
  private readonly drafts = new Map<string, SpeakingLegacySession>();
  readonly user = this.auth.user;
  readonly entries = signal<SpeakingConversation[]>([]);
  readonly selected = signal<string[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly results = signal<SpeakingMigrationResult[]>([]);
  private readonly confirmedState = signal<string | null>(null);
  readonly confirmed = computed(() => !!this.user() && this.confirmedState() === this.user()?.id);
  confirmOwner(value: boolean) {
    this.confirmedOwner = value ? (this.user()?.id ?? null) : null;
    this.confirmedState.set(this.confirmedOwner);
  }
  toggle(id: string) {
    if (!this.busy())
      this.selected.update((ids) =>
        ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
      );
  }
  async scan() {
    const owner = this.user()?.id;
    if (!owner) return;
    this.scannedOwner = owner;
    this.confirmOwner(false);
    this.selected.set([]);
    this.results.set([]);
    this.drafts.clear();
    try {
      const records = (await this.local.listConversations()).filter(
        (record) => !record.ownerId && !record.remoteId,
      );
      const settings = this.local.loadSettings();
      const allDrafts: SpeakingLegacySession[] = [];
      for (const record of records) {
        const detail = await this.local.getConversation(record.id);
        if (detail) allDrafts.push(toLegacySession(record, detail.messages));
      }
      // 舊設定沒有外鍵：只有唯一標題＋摘要對應時才帶入計畫；不確定就留在本機。
      const matches = allDrafts.filter(
        (draft) =>
          draft.title === settings.lastPractice?.title &&
          draft.summaries.at(-1) &&
          records.find((record) => record.id === draft.clientSessionId)?.summary ===
            settings.lastPractice?.summary,
      );
      for (const draft of allDrafts) {
        const record = records.find((record) => record.id === draft.clientSessionId)!;
        if (matches.length === 1 && matches[0] === draft && settings.nextPractice)
          draft.legacyPracticeContext = {
            summaryId: draft.summaries.at(-1)!.id,
            plan: settings.nextPractice,
          };
        this.drafts.set(draft.clientSessionId, record.migrationDrafts?.[owner] ?? draft);
      }
      if (this.user()?.id === owner)
        this.entries.set(records.filter((record) => !record.migratedTo?.[owner]));
    } catch {
      this.error.set('無法讀取舊紀錄，未修改本機資料。');
    }
  }
  async migrate() {
    const owner = this.user()?.id;
    if (
      !owner ||
      owner !== this.scannedOwner ||
      owner !== this.confirmedOwner ||
      this.busy() ||
      !this.selected().length
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    this.results.set([]);
    try {
      for (const id of this.selected()) {
        if (this.user()?.id !== owner) throw new Error('帳號已變更');
        const draft = this.drafts.get(id);
        const local = await this.local.getConversation(id);
        if (!draft || !local) continue;
        const backedUp = {
          ...local.conversation,
          migrationDrafts: { ...local.conversation.migrationDrafts, [owner]: draft },
        };
        await this.local.saveConversation(backedUp);
        let result: SpeakingMigrationResult;
        try {
          if (this.user()?.id !== owner) throw new Error('帳號已變更');
          const { data } = await firstValueFrom(
            this.api.migrateSpeakingHistory({ expectedUserId: owner, sessions: [draft] }),
          );
          result = data[0];
          if (!result) throw new Error('搬移回應不完整');
          if (result.sessionId && ['imported', 'alreadyImported'].includes(result.status)) {
            await this.local.saveConversation({
              ...backedUp,
              migratedTo: { ...backedUp.migratedTo, [owner]: result.sessionId },
            });
          }
        } catch {
          result = {
            clientSessionId: id,
            sessionId: null,
            status: 'failed',
            message: '未完成；原文字、音訊與搬移草稿仍在本機，可重試。',
          };
        }
        this.results.update((results) => [...results, result]);
      }
    } catch {
      this.error.set('帳號已變更，已停止搬移；請重新確認帳號。');
    } finally {
      this.busy.set(false);
    }
  }
}
