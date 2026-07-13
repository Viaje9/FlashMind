import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FmButtonComponent } from '@flashmind/ui';
import type { TopicConversationHistoryItem } from '../../../components/topic-conversation/topic-conversation.domain';

@Component({
  selector: 'app-topic-conversation-history-item',
  imports: [FmButtonComponent],
  template: `
    <article
      class="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-800"
      [attr.data-testid]="'topic-conversation-history-item-' + item().id"
    >
      <div class="flex items-start gap-3">
        <div
          class="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <span class="material-symbols-outlined text-[21px]">forum</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-3">
            <h2 class="font-semibold leading-6 text-slate-900 dark:text-white">
              {{ item().title }}
            </h2>
            <time class="shrink-0 text-[11px] text-slate-400">
              {{ formatUpdatedAt(item().updatedAt) }}
            </time>
          </div>
          <p class="mt-1 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
            {{ item().scenario }}
          </p>
          <p class="mt-3 truncate text-xs text-slate-400">
            {{ item().preview }} · {{ item().messageCount }} 則訊息
          </p>
        </div>
      </div>

      <div
        class="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
      >
        <fm-button
          variant="ghost"
          size="sm"
          [disabled]="deleting()"
          [testId]="'topic-conversation-history-delete-' + item().id"
          (click)="delete.emit(item().id)"
        >
          <span class="material-symbols-outlined text-[17px]">delete</span>
          {{ deleting() ? '刪除中…' : '刪除' }}
        </fm-button>
        <fm-button
          variant="ghost"
          size="sm"
          [disabled]="replaying()"
          [testId]="'topic-conversation-history-repeat-' + item().id"
          (click)="replay.emit(item().id)"
        >
          <span class="material-symbols-outlined text-[17px]">replay</span>
          {{ replaying() ? '建立中…' : '再練一次' }}
        </fm-button>
        <fm-button
          size="sm"
          [testId]="'topic-conversation-history-continue-' + item().id"
          (click)="open.emit(item().id)"
        >
          繼續對話
          <span class="material-symbols-outlined text-[17px]">arrow_forward</span>
        </fm-button>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicConversationHistoryItemComponent {
  readonly item = input.required<TopicConversationHistoryItem>();
  readonly replaying = input(false);
  readonly deleting = input(false);
  readonly open = output<string>();
  readonly replay = output<string>();
  readonly delete = output<string>();

  formatUpdatedAt(value: string): string {
    return new Intl.DateTimeFormat('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
