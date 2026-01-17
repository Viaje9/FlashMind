import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FmEmptyStateComponent, FmFabComponent, FmIconButtonComponent, FmPageHeaderComponent, FmSearchInputComponent } from '@flashmind/ui';
import { FmDeckCardComponent } from '../../components/deck/deck-card/deck-card.component';

interface DeckPreview {
  id: string;
  title: string;
  newCount: number;
  reviewCount: number;
  progress: number;
  completed: boolean;
  showAction: boolean;
  actionLabel: string;
}

@Component({
  selector: 'app-deck-list-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmSearchInputComponent,
    FmDeckCardComponent,
    FmEmptyStateComponent,
    FmFabComponent,
    RouterLink
  ],
  templateUrl: './deck-list.component.html',
  styleUrl: './deck-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckListComponent {
  private readonly router = inject(Router);

  readonly decks: DeckPreview[] = [
    {
      id: 'deck-1',
      title: '英文詞彙',
      newCount: 20,
      reviewCount: 15,
      progress: 45,
      completed: false,
      showAction: true,
      actionLabel: '開始學習'
    },
    {
      id: 'deck-2',
      title: '歷史年代',
      newCount: 30,
      reviewCount: 0,
      progress: 10,
      completed: false,
      showAction: true,
      actionLabel: '開始學習'
    },
    {
      id: 'deck-3',
      title: '數學公式',
      newCount: 0,
      reviewCount: 0,
      progress: 100,
      completed: true,
      showAction: false,
      actionLabel: '已完成'
    }
  ];

  onDeckAction(deckId: string) {
    void this.router.navigate(['/decks', deckId]);
  }
}
