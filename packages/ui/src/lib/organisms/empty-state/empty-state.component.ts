import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmEmptyStateComponent {
  readonly icon = input('library_add');
  readonly title = input('尚無資料');
  readonly description = input('目前還沒有內容，請新增第一筆資料。');
}
