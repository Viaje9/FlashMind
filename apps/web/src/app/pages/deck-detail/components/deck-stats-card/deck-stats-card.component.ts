import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FmButtonComponent } from '@flashmind/ui';

@Component({
  selector: 'fm-deck-stats-card',
  imports: [FmButtonComponent],
  templateUrl: './deck-stats-card.component.html',
  styleUrl: './deck-stats-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmDeckStatsCardComponent {
  readonly newCount = input(0);
  readonly reviewCount = input(0);
  readonly enableReverse = input(false);
  readonly createdAtLabel = input('');
  readonly lastReviewLabel = input('');
  readonly actionLabel = input('開始學習');
  readonly actionDisabled = input(false);
  readonly testId = input<string>();

  readonly actionClick = output<void>();

  readonly metaLine = computed(() => {
    const createdAt = this.createdAtLabel();
    const lastReview = this.lastReviewLabel();
    if (createdAt && lastReview) {
      return `${createdAt} • 上次複習：${lastReview}`;
    }
    if (createdAt) {
      return `建立於 ${createdAt}`;
    }
    if (lastReview) {
      return `上次複習：${lastReview}`;
    }
    return '';
  });
}
