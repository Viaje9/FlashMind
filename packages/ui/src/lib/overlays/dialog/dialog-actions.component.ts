import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-dialog-actions',
  template: `
    <div
      class="fm-dialog-actions"
      [class.fm-dialog-actions--align-start]="align() === 'start'"
      [class.fm-dialog-actions--align-center]="align() === 'center'"
      [attr.data-testid]="testId()">
      <ng-content></ng-content>
    </div>
  `,
  styleUrl: './dialog-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FmDialogActionsComponent {
  readonly align = input<'start' | 'center' | 'end'>('end');
  readonly testId = input<string>();
}
