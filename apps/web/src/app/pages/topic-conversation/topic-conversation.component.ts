import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FmAlertComponent, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { TopicConversationStore } from '../../components/topic-conversation/topic-conversation.store';
import { TopicConversationComposerComponent } from './components/topic-conversation-composer.component';
import { TopicConversationMessageComponent } from './components/topic-conversation-message.component';

@Component({
  selector: 'app-topic-conversation-page',
  imports: [
    RouterLink,
    FmAlertComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    TopicConversationComposerComponent,
    TopicConversationMessageComponent,
  ],
  templateUrl: './topic-conversation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicConversationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(TopicConversationStore);

  readonly loading = computed(() => this.store.creating() || this.store.loadingConversation());

  private readonly keepStreamingMessageVisible = effect(() => {
    const lastMessage = this.store.messages().at(-1);
    if (!lastMessage || !this.store.sending()) return;

    this.scrollToBottom('auto');
  });

  async ngOnInit(): Promise<void> {
    const sessionId = this.route.snapshot.queryParamMap.get('sessionId');
    if (sessionId) {
      const loaded = await this.store.loadConversation(sessionId);
      if (loaded) this.scrollToBottom('auto');
      return;
    }

    const forceNew = this.route.snapshot.queryParamMap.get('new') === 'true';
    if (forceNew || !(await this.store.loadLatestConversation())) {
      await this.startNewConversation();
    }
  }

  async startNewConversation(): Promise<void> {
    const session = await this.store.createConversation();
    if (!session) return;

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sessionId: session.id },
      replaceUrl: true,
    });
    this.scrollToBottom();
  }

  async onSendMessage(message: string): Promise<void> {
    const sendPromise = this.store.sendMessage(message);
    this.scrollToBottom('auto');
    const success = await sendPromise;
    if (!success) return;

    const sessionId = this.store.currentSession()?.id;
    if (sessionId) {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { sessionId },
        replaceUrl: true,
      });
    }

    this.scrollToBottom();
  }

  async onHintRequest(): Promise<void> {
    await this.store.requestHint();
    this.scrollToBottom();
  }

  private scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    setTimeout(() => {
      document
        .querySelector('[data-topic-conversation-bottom]')
        ?.scrollIntoView({ block: 'end', behavior });
    });
  }
}
