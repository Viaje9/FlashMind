import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AssistantMarkdownComponent } from '../../../components/shared/assistant-markdown/assistant-markdown.component';
import { TopicConversationRole } from '@flashmind/api-client';
import type { TopicConversationMessageView } from '../../../components/topic-conversation/topic-conversation.domain';

@Component({
  selector: 'app-topic-conversation-message',
  imports: [AssistantMarkdownComponent],
  template: `
    <article
      class="flex flex-col gap-2"
      [class.items-end]="isUser()"
      [class.items-start]="!isUser()"
      [attr.aria-live]="message().streaming ? 'polite' : null"
      [attr.data-testid]="'topic-conversation-message-' + message().id"
    >
      <div
        class="relative max-w-[88%] px-4 py-3 text-[15px] leading-7"
        [class.px-0]="isSource() && !isUser()"
        [class.py-2]="isSource() && !isUser()"
        [class.w-full]="isDiscussion() && !isUser()"
        [style.max-width]="isDiscussion() && !isUser() ? '100%' : null"
        [attr.data-speaking-assistant-message-id]="
          isDiscussion() || isSource() ? message().id : null
        "
        [attr.data-speaking-selection-context]="
          isDiscussion() || isSource() ? 'review-discussion' : null
        "
        [attr.data-speaking-selection-message-id]="
          isDiscussion() || isSource() ? message().id : null
        "
        [class.rounded-2xl]="isUser()"
        [class.rounded-xl]="isDiscussion() && !isUser()"
        [class.rounded-br-md]="isUser()"
        [class.bg-emerald-700]="isUser()"
        [class.text-white]="isUser()"
        [class.shadow-sm]="isUser()"
        [class.border-l-2]="!isUser() && !isDiscussion() && !isSource()"
        [class.border-amber-400]="!isUser() && !isDiscussion() && !isSource()"
        [class.bg-white]="!isUser() && !isDiscussion() && !isSource()"
        [class.bg-primary/10]="isDiscussion() && !isUser()"
        [class.text-slate-800]="!isUser() && !isDiscussion()"
        [class.dark:bg-slate-900]="!isUser() && !isDiscussion() && !isSource()"
        [class.dark:text-slate-100]="!isUser()"
      >
        @if (message().content) {
          @if (isUser()) {
            <p class="whitespace-pre-wrap">{{ message().content }}</p>
          } @else {
            <app-assistant-markdown [content]="message().content" />
          }
          @if (message().streaming) {
            <span
              class="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle"
              aria-hidden="true"
            ></span>
          }
        } @else if (message().streaming) {
          <div class="flex h-7 items-center gap-1.5" aria-label="AI 正在回覆">
            <span class="size-1.5 animate-pulse rounded-full bg-emerald-500"></span>
            <span
              class="size-1.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:120ms]"
            ></span>
            <span
              class="size-1.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:240ms]"
            ></span>
          </div>
        }
      </div>

      @if (message().correction; as correction) {
        <aside
          class="max-w-[88%] rounded-xl border px-3 py-2.5"
          [class.border-emerald-200]="correction.tone === 'success'"
          [class.bg-emerald-50]="correction.tone === 'success'"
          [class.border-sky-200]="correction.tone === 'info'"
          [class.bg-sky-50]="correction.tone === 'info'"
          [class.border-amber-200]="correction.tone === 'warning'"
          [class.bg-amber-50]="correction.tone === 'warning'"
          [class.dark:border-emerald-900]="correction.tone === 'success'"
          [class.dark:bg-emerald-950/40]="correction.tone === 'success'"
          [class.dark:border-sky-900]="correction.tone === 'info'"
          [class.dark:bg-sky-950/40]="correction.tone === 'info'"
          [class.dark:border-amber-900]="correction.tone === 'warning'"
          [class.dark:bg-amber-950/40]="correction.tone === 'warning'"
          [attr.data-testid]="'topic-conversation-correction-' + message().id"
        >
          <p
            class="flex items-center gap-1.5 text-xs font-bold"
            [class.text-emerald-700]="correction.tone === 'success'"
            [class.text-sky-700]="correction.tone === 'info'"
            [class.text-amber-700]="correction.tone === 'warning'"
            [class.dark:text-emerald-300]="correction.tone === 'success'"
            [class.dark:text-sky-300]="correction.tone === 'info'"
            [class.dark:text-amber-300]="correction.tone === 'warning'"
          >
            <span class="material-symbols-outlined text-[15px]">
              {{ correction.tone === 'success' ? 'check_circle' : 'ink_pen' }}
            </span>
            {{ correction.label }}
          </p>

          @if (correction.showDetails) {
            @if (correction.suggestedText) {
              <p class="mt-2 text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">
                {{ correction.suggestedText }}
              </p>
            }
            @if (correction.explanation) {
              <p class="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {{ correction.explanation }}
              </p>
            }
          }
        </aside>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicConversationMessageComponent {
  readonly message = input.required<TopicConversationMessageView>();
  /**
   * 回顧討論使用獨立的訊息呈現，避免把原始口說紀錄誤認成同一段對話。
   * 預設值維持主題對話頁既有外觀。
   */
  readonly presentation = input<'default' | 'discussion' | 'source'>('default');
  readonly isUser = computed(() => this.message().role === TopicConversationRole.User);
  readonly isDiscussion = computed(() => this.presentation() === 'discussion');
  readonly isSource = computed(() => this.presentation() === 'source');
}
