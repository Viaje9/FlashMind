import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

type CardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

@Component({
  selector: 'fm-card-list-item',
  templateUrl: './card-list-item.component.html',
  styleUrl: './card-list-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmCardListItemComponent {
  readonly title = input('');
  readonly description = input('');
  readonly editLabel = input('編輯');
  readonly deleteLabel = input('刪除');
  readonly testId = input<string>();
  readonly state = input<CardState>('NEW');
  readonly due = input<string | null>(null);

  readonly editClick = output<void>();
  readonly deleteClick = output<void>();

  readonly reviewInfo = computed(() => {
    const state = this.state();
    const due = this.due();

    if (state === 'NEW') {
      return { text: '新卡片・尚未學習', colorClass: 'text-primary dark:text-primary-dark' };
    }

    if (!due) {
      return { text: '等待排程', colorClass: 'text-slate-400 dark:text-slate-500' };
    }

    const now = Date.now();
    const dueTime = new Date(due).getTime();
    const diffMs = dueTime - now;
    const diffMinutes = Math.round(diffMs / 60_000);
    const diffHours = Math.round(diffMs / 3_600_000);
    const diffDays = Math.round(diffMs / 86_400_000);

    if (diffMs <= 0) {
      const overdueDays = Math.abs(diffDays);
      if (overdueDays < 1) {
        return { text: '今天到期', colorClass: 'text-red-500 dark:text-red-400' };
      }
      return { text: `已逾期 ${overdueDays} 天`, colorClass: 'text-red-500 dark:text-red-400' };
    }

    if (diffMinutes < 60) {
      return { text: `${diffMinutes} 分鐘後到期`, colorClass: 'text-emerald-500 dark:text-emerald-400' };
    }
    if (diffHours < 24) {
      return { text: `${diffHours} 小時後到期`, colorClass: 'text-emerald-500 dark:text-emerald-400' };
    }
    return { text: `${diffDays} 天後`, colorClass: 'text-slate-400 dark:text-slate-500' };
  });
}
