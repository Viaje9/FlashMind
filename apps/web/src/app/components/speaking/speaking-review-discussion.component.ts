import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  signal,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { TopicConversationComposerComponent } from '../../pages/topic-conversation/components/topic-conversation-composer.component';
import { TopicConversationMessageComponent } from '../../pages/topic-conversation/components/topic-conversation-message.component';
import type { SpeakingConversation, SpeakingMessage } from './speaking.domain';
import { SpeakingSummaryComponent } from './speaking-summary.component';
import { SpeakingReviewDiscussionStore } from './speaking-review-discussion.store';

@Component({
  selector: 'app-speaking-review-discussion',
  imports: [
    FmButtonComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    SpeakingSummaryComponent,
    TopicConversationComposerComponent,
    TopicConversationMessageComponent,
  ],
  providers: [SpeakingReviewDiscussionStore],
  template: `
    <div class="flex min-h-dvh flex-col" data-testid="speaking-review-discussion">
      <fm-page-header title="討論改進方向" layout="center">
        <fm-button
          class="fm-header-left"
          variant="ghost"
          size="sm"
          testId="speaking-discussion-back"
          (click)="closed.emit()"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
          返回
        </fm-button>
      </fm-page-header>
      <main class="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <section
          aria-label="原對話與摘要"
          class="space-y-4"
          data-testid="speaking-discussion-source"
        >
          <h2 #sourceStart tabindex="-1" class="scroll-mt-24 text-lg font-semibold">
            原對話與摘要
          </h2>
          @for (item of originalMessages(); track item.source.id) {
            @if (item.source.role === 'summary') {
              <app-speaking-summary
                [content]="item.source.text ?? ''"
                [showCopy]="false"
                [initiallyCollapsed]="true"
              />
            } @else {
              <app-topic-conversation-message [message]="item.message" />
              @if (item.source.translatedText) {
                <p class="text-sm text-slate-600 dark:text-slate-300">
                  {{ item.source.translatedText }}
                </p>
              }
            }
          }
          @if (!hasOriginalSummary() && conversation().summary) {
            <app-speaking-summary
              [content]="conversation().summary ?? ''"
              [showCopy]="false"
              [initiallyCollapsed]="true"
            />
          }
        </section>
        <div
          class="border-t border-slate-200 pt-6 dark:border-slate-700"
          data-testid="speaking-discussion-start"
        >
          <h2 class="mb-3 text-lg font-semibold">從這裡開始討論</h2>
          <div class="border-l-2 border-amber-400 pl-3">
            <p class="font-semibold">{{ conversation().title || '本次口說練習' }}</p>
            <p
              class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300"
              data-testid="speaking-discussion-notice"
            >
              已帶入這次對話與回顧。後續討論不儲存，離開後即清除，也不會出現在原本的對話詳情。
            </p>
          </div>
        </div>
        @for (message of store.messages(); track message.id) {
          <app-topic-conversation-message [message]="message" />
        }
        @if (store.sending()) {
          <p role="status" class="text-sm text-slate-600 dark:text-slate-300">正在整理建議…</p>
        }
        @if (store.error()) {
          <p role="alert" class="text-sm text-red-700 dark:text-red-300">{{ store.error() }}</p>
        }
        <div #bottom class="scroll-mb-44"></div>
      </main>
      <footer class="sticky bottom-0">
        <div class="mx-auto flex w-full max-w-3xl justify-end px-4 pt-2">
          <fm-icon-button
            variant="neutral"
            size="sm"
            class="rounded-full bg-background-light shadow-sm dark:bg-background-dark"
            [ariaLabel]="viewingSource() ? '回到後續討論' : '查看原對話與摘要'"
            testId="speaking-discussion-jump"
            (click)="toggleSource()"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{
              viewingSource() ? 'arrow_downward' : 'arrow_upward'
            }}</span>
          </fm-icon-button>
        </div>
        <app-topic-conversation-composer
          [showHint]="false"
          inputLabel="詢問這次對話可以改進的地方"
          placeholder="想先討論哪一句？"
          [maxMessageLength]="1000"
          [sending]="store.sending()"
          (messageSubmit)="send($event)"
        />
        <p
          class="bg-background-light pb-2 text-center text-xs text-slate-600 dark:bg-background-dark dark:text-slate-300"
        >
          可用中文或英文提問，每則最多 1000 字。
        </p>
      </footer>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeakingReviewDiscussionComponent implements OnInit {
  readonly conversation = input.required<SpeakingConversation>();
  readonly sourceMessages = input.required<SpeakingMessage[]>();
  readonly originalMessages = computed(() =>
    this.sourceMessages().map((source) => ({
      source,
      message: {
        id: source.id,
        role: source.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: source.text || '（原紀錄沒有逐字稿）',
        correction: null,
        createdAt: source.createdAt,
        streaming: false,
      },
    })),
  );
  readonly hasOriginalSummary = computed(() =>
    this.sourceMessages().some((message) => message.role === 'summary'),
  );
  readonly viewingSource = signal(false);
  readonly closed = output<void>();
  readonly store = inject(SpeakingReviewDiscussionStore);
  private readonly composer = viewChild(TopicConversationComposerComponent);
  private readonly sourceStart = viewChild<ElementRef<HTMLElement>>('sourceStart');
  private readonly bottom = viewChild<ElementRef<HTMLElement>>('bottom');
  private readonly scroll = afterRenderEffect(() => {
    this.store.messages();
    this.store.sending();
    if (this.viewingSource()) return;
    this.bottom()?.nativeElement.scrollIntoView({ block: 'end' });
  });

  ngOnInit(): void {
    this.store.start(this.conversation(), this.sourceMessages());
  }

  toggleSource(): void {
    this.viewingSource.update((value) => !value);
    if (this.viewingSource()) {
      this.sourceStart()?.nativeElement.scrollIntoView({ block: 'start' });
      this.sourceStart()?.nativeElement.focus({ preventScroll: true });
    }
  }

  async send(message: string): Promise<void> {
    this.viewingSource.set(false);
    if (!(await this.store.sendMessage(message))) {
      const composer = this.composer();
      if (composer && !composer.formModel().message) composer.formModel.set({ message });
    }
  }
}
