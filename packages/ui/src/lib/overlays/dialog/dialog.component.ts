import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-dialog',
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FmDialogComponent {
  readonly width = input<string>();
  readonly maxWidth = input<string>('600px');
}
