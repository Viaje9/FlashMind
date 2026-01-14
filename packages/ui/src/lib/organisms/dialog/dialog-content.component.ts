import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'fm-dialog-content',
  template: `
    <div class="fm-dialog-content">
      <ng-content></ng-content>
    </div>
  `,
  styleUrl: './dialog-content.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FmDialogContentComponent {}
