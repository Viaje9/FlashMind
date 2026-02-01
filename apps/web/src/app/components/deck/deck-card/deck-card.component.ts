import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FmButtonComponent, FmProgressBarComponent } from '@flashmind/ui';

@Component({
  selector: 'fm-deck-card',
  imports: [FmButtonComponent, FmProgressBarComponent],
  templateUrl: './deck-card.component.html',
  styleUrl: './deck-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmDeckCardComponent {
  readonly title = input('');
  readonly newCount = input(0);
  readonly reviewCount = input(0);
  readonly progress = input(0);
  readonly completed = input(false);
  readonly enableReverse = input(false);
  readonly showAction = input(true);
  readonly actionLabel = input('開始學習');
  readonly actionDisabled = input(false);
  readonly testId = input<string>();
  readonly dailyNewCards = input(0);
  readonly dailyReviewCards = input(0);
  readonly todayNewStudied = input(0);
  readonly todayReviewStudied = input(0);

  readonly actionClick = output<void>();
  readonly cardClick = output<void>();

  readonly newProgressPercent = computed(() => {
    const limit = this.dailyNewCards();
    if (limit <= 0) return 0;
    return Math.min(100, (this.todayNewStudied() / limit) * 100);
  });

  readonly reviewProgressPercent = computed(() => {
    const limit = this.dailyReviewCards();
    if (limit <= 0) return 0;
    return Math.min(100, (this.todayReviewStudied() / limit) * 100);
  });
}
