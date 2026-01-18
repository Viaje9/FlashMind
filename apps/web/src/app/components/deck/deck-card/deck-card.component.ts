import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FmBadgeComponent, FmIconButtonComponent, FmProgressBarComponent } from '@flashmind/ui';

export interface DeckTag {
  id: string;
  text: string;
  tone: 'info' | 'warning' | 'success' | 'neutral';
}

@Component({
  selector: 'fm-deck-card',
  imports: [FmBadgeComponent, FmIconButtonComponent, FmProgressBarComponent],
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
  readonly tags = input<DeckTag[] | null>(null);
  readonly showAction = input(true);
  readonly actionLabel = input('開始學習');

  readonly actionClick = output<void>();
  readonly cardClick = output<void>();

  readonly tagList = computed<DeckTag[]>(() => {
    const custom = this.tags();
    if (custom && custom.length) {
      return custom;
    }

    if (this.completed()) {
      return [{ id: 'completed', text: '已完成', tone: 'success' }];
    }

    const next: DeckTag[] = [];
    const newCount = this.newCount();
    const reviewCount = this.reviewCount();

    next.push({
      id: 'new',
      text: `${newCount} 新卡片`,
      tone: newCount > 0 ? 'info' : 'neutral'
    });

    next.push({
      id: 'review',
      text: `${reviewCount} 待複習`,
      tone: reviewCount > 0 ? 'warning' : 'neutral'
    });

    return next;
  });
}
