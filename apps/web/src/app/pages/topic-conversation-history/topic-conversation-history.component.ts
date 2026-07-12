import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FmAlertComponent,
  FmButtonComponent,
  FmEmptyStateComponent,
  FmIconButtonComponent,
  FmPageHeaderComponent,
} from '@flashmind/ui';
import { TopicConversationStore } from '../../components/topic-conversation/topic-conversation.store';
import { TopicConversationHistoryItemComponent } from './components/topic-conversation-history-item.component';

@Component({
  selector: 'app-topic-conversation-history-page',
  imports: [
    RouterLink,
    FmAlertComponent,
    FmButtonComponent,
    FmEmptyStateComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    TopicConversationHistoryItemComponent,
  ],
  templateUrl: './topic-conversation-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicConversationHistoryComponent implements OnInit {
  private readonly router = inject(Router);
  readonly store = inject(TopicConversationStore);
  readonly replayingId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.store.loadHistory();
  }

  openConversation(id: string): void {
    void this.router.navigate(['/topic-conversations'], {
      queryParams: { sessionId: id },
    });
  }

  async replayConversation(id: string): Promise<void> {
    this.replayingId.set(id);
    const session = await this.store.replayConversation(id);
    this.replayingId.set(null);
    if (!session) return;

    await this.router.navigate(['/topic-conversations'], {
      queryParams: { sessionId: session.id },
    });
  }
}
