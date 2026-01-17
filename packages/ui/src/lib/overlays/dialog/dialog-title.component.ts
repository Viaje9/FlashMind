import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-dialog-title',
  template: `
    <h2 class="fm-dialog-title" [attr.data-testid]="testId()">
      <ng-content></ng-content>
    </h2>
  `,
  styleUrl: './dialog-title.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FmDialogTitleComponent {
  readonly testId = input<string>();
}
