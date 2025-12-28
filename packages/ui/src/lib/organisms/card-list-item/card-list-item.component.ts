import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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

  readonly editClick = output<void>();
  readonly deleteClick = output<void>();
}
