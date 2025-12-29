import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FmCardListItemComponent,
  FmDeckStatsCardComponent,
  FmFabComponent,
  FmIconButtonComponent,
  FmPageHeaderComponent,
  FmSearchInputComponent
} from '../../../../../../packages/ui/src/index';

interface CardPreview {
  id: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-deck-detail-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmDeckStatsCardComponent,
    FmSearchInputComponent,
    FmCardListItemComponent,
    FmFabComponent
  ],
  templateUrl: './deck-detail.component.html',
  styleUrl: './deck-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckDetailComponent {
  readonly cards: CardPreview[] = [
    {
      id: 'card-1',
      title: 'Serendipity',
      description: '意外發現珍奇事物的能力；機緣湊巧。'
    },
    {
      id: 'card-2',
      title: 'Ephemeral',
      description: '短暫的；朝生暮死的；生命短促的。'
    },
    {
      id: 'card-3',
      title: 'Eloquent',
      description: '雄辯的；有口才的；動人的。'
    },
    {
      id: 'card-4',
      title: 'Resilience',
      description: '韌性；彈性；恢復力。'
    }
  ];
}
