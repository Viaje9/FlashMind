import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FmButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import {
  type SpeakingConversation,
  type SpeakingMessage,
} from '../../components/speaking/speaking.domain';
import { SpeakingRepository } from '../../components/speaking/speaking.repository';

@Component({
  selector: 'app-speaking-history-page',
  imports: [RouterLink, FmPageHeaderComponent, FmButtonComponent],
  templateUrl: './speaking-history.component.html',
  styleUrl: './speaking-history.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeakingHistoryComponent implements OnInit {
  private readonly repository = inject(SpeakingRepository);
  private readonly router = inject(Router);

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

    const result = await this.repository.getConversation(conversationId);
    this.detailMessages.set(result?.messages ?? []);

    this.loadingDetail.set(false);
  }

  closeDetail(): void {
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
    await this.repository.deleteConversation(conversationId);
    await this.loadConversations();
    this.deletingId.set(null);
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

  private async loadConversations(): Promise<void> {
    this.loading.set(true);
    this.conversations.set(await this.repository.listConversations());
    this.loading.set(false);
  }
}
