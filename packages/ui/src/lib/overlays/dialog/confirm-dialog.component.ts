import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FmDialogComponent } from './dialog.component';
import { FmDialogTitleComponent } from './dialog-title.component';
import { FmDialogContentComponent } from './dialog-content.component';
import { FmDialogActionsComponent } from './dialog-actions.component';
import { FmButtonComponent } from '../../primitives/button/button.component';
import { DialogRef } from './dialog-ref';
import { DIALOG_CONFIG } from './dialog.service';

export interface ConfirmDialogData {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'fm-confirm-dialog',
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
        <fm-button variant="ghost" (click)="onCancel()">{{ cancelText }}</fm-button>
        <fm-button variant="danger" (click)="onConfirm()">{{ confirmText }}</fm-button>
      </fm-dialog-actions>
    </fm-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmConfirmDialogComponent {
  private dialogRef = inject(DialogRef);
  private config = inject(DIALOG_CONFIG);

  title = this.config.data?.title ?? '確認';
  message = this.config.data?.message ?? '確定要繼續嗎？';
  confirmText = this.config.data?.confirmText ?? '確認';
  cancelText = this.config.data?.cancelText ?? '取消';

  onConfirm() {
    this.dialogRef.close(true);
  }

  onCancel() {
    this.dialogRef.close(false);
  }
}
