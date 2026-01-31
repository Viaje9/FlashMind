import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FmDialogComponent } from './dialog.component';
import { FmDialogTitleComponent } from './dialog-title.component';
import { FmDialogContentComponent } from './dialog-content.component';
import { FmDialogActionsComponent } from './dialog-actions.component';
import { FmButtonComponent } from '../../primitives/button/button.component';
import { DialogRef } from './dialog-ref';
import { DIALOG_CONFIG } from './dialog.service';

export interface AlertDialogData {
  title?: string;
  message?: string;
  buttonText?: string;
}

@Component({
  selector: 'fm-alert-dialog',
  imports: [
    FmDialogComponent,
    FmDialogTitleComponent,
    FmDialogContentComponent,
    FmDialogActionsComponent,
    FmButtonComponent,
  ],
  template: `
    <fm-dialog>
      <fm-dialog-title>{{ title }}</fm-dialog-title>
      <fm-dialog-content>
        {{ message }}
      </fm-dialog-content>
      <fm-dialog-actions>
        <fm-button (click)="onClose()">{{ buttonText }}</fm-button>
      </fm-dialog-actions>
    </fm-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmAlertDialogComponent {
  private dialogRef = inject(DialogRef);
  private config = inject(DIALOG_CONFIG);

  title = this.config.data?.title ?? '提示';
  message = this.config.data?.message ?? '';
  buttonText = this.config.data?.buttonText ?? '確認';

  onClose() {
    this.dialogRef.close();
  }
}
