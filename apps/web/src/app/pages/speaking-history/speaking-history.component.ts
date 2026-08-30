import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { SpeakingHistoryMigrationComponent } from '../../components/speaking/speaking-history-migration.component';
import { SpeakingAudioPlayerService } from '../../components/speaking/speaking-audio-player.service';
import { Router, RouterLink } from '@angular/router';
import { FmButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import {
  type SpeakingConversation,
  type SpeakingMessage,
} from '../../components/speaking/speaking.domain';
import { SpeakingSummaryComponent } from '../../components/speaking/speaking-summary.component';
import { SpeakingRepository } from '../../components/speaking/speaking.repository';

@Component({
  selector: 'app-speaking-history-page',
  imports: [
    RouterLink,
    A11yModule,
    FmPageHeaderComponent,
    FmButtonComponent,
    SpeakingHistoryMigrationComponent,
    SpeakingSummaryComponent,
  ],
  templateUrl: './speaking-history.component.html',
  styleUrl: './speaking-history.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeakingHistoryComponent implements OnInit {
  private readonly repository = inject(SpeakingRepository);
  private readonly router = inject(Router);
  private readonly audio = inject(SpeakingAudioPlayerService);
  private detailRequest = 0;
  readonly error = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly pendingSync = signal(0);
  async retrySync() {
    await this.repository.retryPending();
    await this.loadConversations();
  }
  async playAudio(message: SpeakingMessage) {
    if (!message.audioBlobKey) return;
    const blob = await this.repository.getAudioBlob(message.audioBlobKey);
    if (blob) await this.audio.play(blob, message.audioBlobKey, { auto: false });
    else this.error.set('這台裝置已沒有原始音訊，文字紀錄仍保留。');
  }
  get continueLabel(): string {
    return this.selectedConversation?.source === 'APP' && !this.selectedConversation.reviewed
      ? '繼續對話'
      : '延續為新練習';
  }

  readonly loading = signal(true);
  readonly deletingId = signal<string | null>(null);
  readonly copiedConversationId = signal<string | null>(null);
  readonly selectedConversationId = signal<string | null>(null);
  readonly loadingDetail = signal(false);
  readonly pendingDeleteConversationId = signal<string | null>(null);

  readonly conversations = signal<SpeakingConversation[]>([]);
  readonly detailMessages = signal<SpeakingMessage[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadConversations();
  }

  async openConversation(conversationId: string): Promise<void> {
    this.selectedConversationId.set(conversationId);
    this.loadingDetail.set(true);

    this.error.set(null);
    const request = ++this.detailRequest;
    try {
      const result = await this.repository.getRemoteConversation(conversationId);
      if (request !== this.detailRequest) return;
      this.detailMessages.set(result.messages);
      this.conversations.update((rows) =>
        rows.map((row) =>
          row.id === conversationId ? { ...result.conversation, id: conversationId } : row,
        ),
      );
    } catch {
      this.error.set('無法讀取完整紀錄，請確認網路或重新登入。');
    } finally {
      if (request === this.detailRequest) this.loadingDetail.set(false);
    }
  }

  closeDetail(): void {
    this.detailRequest++;
    this.audio.stop();
    this.selectedConversationId.set(null);
    this.detailMessages.set([]);
  }

  async continueConversation(): Promise<void> {
    const conversationId = this.selectedConversationId();
    if (!conversationId) {
      return;
    }

    await this.router.navigate(['/speaking'], { queryParams: { conversationId } });
  }

  requestDeleteConversation(conversationId: string): void {
    this.pendingDeleteConversationId.set(conversationId);
  }

  cancelDeleteConversation(): void {
    this.pendingDeleteConversationId.set(null);
  }

  async confirmDeleteConversation(): Promise<void> {
    const conversationId = this.pendingDeleteConversationId();
    if (!conversationId) {
      return;
    }

    await this.deleteConversation(conversationId);
    this.pendingDeleteConversationId.set(null);

    if (this.selectedConversationId() === conversationId) {
      this.closeDetail();
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.deletingId.set(conversationId);
    try {
      await this.repository.deleteConversation(conversationId);
      await this.loadConversations();
    } catch {
      this.error.set('刪除未完成，紀錄仍保留，請稍後重試。');
    } finally {
      this.deletingId.set(null);
    }
  }

  async copySummary(conversation: SpeakingConversation): Promise<void> {
    const summary = conversation.summary?.trim();
    if (!summary || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(summary);
    this.copiedConversationId.set(conversation.id);

    setTimeout(() => {
      if (this.copiedConversationId() === conversation.id) {
        this.copiedConversationId.set(null);
      }
    }, 1500);
  }

  get selectedConversation(): SpeakingConversation | null {
    const selectedId = this.selectedConversationId();
    if (!selectedId) {
      return null;
    }

    return this.conversations().find((item) => item.id === selectedId) ?? null;
  }

  formatUpdatedAt(value: string): string {
    return new Intl.DateTimeFormat('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  async loadConversations(append = false): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.repository.listConversationPage(
        append ? (this.nextCursor() ?? undefined) : undefined,
      );
      this.conversations.update((rows) => (append ? [...rows, ...page.data] : page.data));
      this.nextCursor.set(page.meta.hasMore ? page.meta.nextCursor : null);
      this.pendingSync.set(await this.repository.pendingCount());
    } catch {
      this.error.set('無法讀取口說歷史，請確認網路或重新登入。');
    } finally {
      this.loading.set(false);
    }
  }
}
