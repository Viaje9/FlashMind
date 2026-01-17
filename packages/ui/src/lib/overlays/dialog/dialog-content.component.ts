import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-dialog-content',
  template: `
    <div class="fm-dialog-content" [attr.data-testid]="testId()">
      <ng-content></ng-content>
    </div>
  `,
  styleUrl: './dialog-content.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FmDialogContentComponent {
  readonly testId = input<string>();
}
