import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { canSendTopicConversationMessage } from '../../../components/topic-conversation/topic-conversation.domain';

@Component({
  selector: 'app-topic-conversation-composer',
  imports: [FormField],
  template: `
    <form
      class="bg-gradient-to-t from-background-light via-background-light/98 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-4 dark:from-background-dark dark:via-background-dark/98"
      (submit)="$event.preventDefault(); onSubmit()"
    >
      <div class="mx-auto w-full max-w-3xl">
        <div
          class="rounded-[26px] border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.14)] ring-1 ring-white/80 backdrop-blur-xl transition focus-within:border-emerald-400 dark:border-slate-700 dark:bg-slate-900/95 dark:ring-white/5"
        >
          <ng-content select="[topic-conversation-composer-context]"></ng-content>
          <div class="flex items-end gap-1.5">
            @if (showHint()) {
              <button
                type="button"
                class="grid size-11 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
                [disabled]="hintLoading() || sending()"
                aria-label="給我提示"
                data-testid="topic-conversation-hint"
                (click)="hintRequest.emit()"
              >
                <span
                  class="material-symbols-outlined text-[21px]"
                  [class.animate-pulse]="hintLoading()"
                  >lightbulb</span
                >
              </button>
            }

            <textarea
              [formField]="messageForm.message"
              rows="1"
              [attr.aria-label]="inputLabel()"
              [placeholder]="placeholder()"
              data-testid="topic-conversation-input"
              class="max-h-32 min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-[16px] leading-6 text-slate-900 outline-none [field-sizing:content] dark:text-white"
              (keydown)="onKeydown($event)"
            ></textarea>

            <button
              type="submit"
              class="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-sm transition enabled:hover:bg-emerald-500 enabled:active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              [disabled]="!canSubmit()"
              [attr.aria-label]="sending() ? 'AI 回覆中' : '送出訊息'"
              data-testid="topic-conversation-send"
            >
              <span
                class="material-symbols-outlined text-[20px]"
                [class.animate-pulse]="sending()"
                >{{ sending() ? 'more_horiz' : 'arrow_upward' }}</span
              >
            </button>
          </div>
        </div>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicConversationComposerComponent {
  readonly showHint = input(true);
  readonly inputLabel = input('輸入英文回應');
  readonly placeholder = input('');
  readonly maxMessageLength = input(4000);
  readonly sending = input(false);
  readonly hintLoading = input(false);
  readonly messageSubmit = output<string>();
  readonly hintRequest = output<void>();

  readonly formModel = signal({ message: '' });
  readonly messageForm = form(this.formModel, (fields) => {
    maxLength(fields.message, () => this.maxMessageLength(), { message: '訊息超過字數上限' });
  });
  readonly canSubmit = computed(
    () =>
      canSendTopicConversationMessage(this.formModel().message, this.sending()) &&
      this.formModel().message.trim().length <= this.maxMessageLength(),
  );

  onSubmit(): void {
    if (!this.canSubmit()) return;

    const message = this.formModel().message.trim();
    this.messageSubmit.emit(message);
    this.clear();
  }

  onKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (
      keyboardEvent.key !== 'Enter' ||
      keyboardEvent.isComposing ||
      keyboardEvent.keyCode === 229 ||
      (!keyboardEvent.metaKey && !keyboardEvent.ctrlKey)
    ) {
      return;
    }

    keyboardEvent.preventDefault();
    this.onSubmit();
  }

  clear(): void {
    this.formModel.set({ message: '' });
  }
}
