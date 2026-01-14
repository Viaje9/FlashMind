import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FmDialogComponent,
  FmDialogTitleComponent,
  FmDialogContentComponent,
  FmDialogActionsComponent,
  FmButtonComponent,
} from '../../../../../../packages/ui/src/index';
import { DialogRef } from '../../services/dialog/dialog-ref';
import { DIALOG_CONFIG } from '../../services/dialog/dialog.service';

@Component({
  selector: 'app-confirm-dialog',
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
        <fm-button variant="ghost" (click)="onCancel()">取消</fm-button>
        <fm-button variant="danger" (click)="onConfirm()">確認</fm-button>
      </fm-dialog-actions>
    </fm-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  private dialogRef = inject(DialogRef);
  private config = inject(DIALOG_CONFIG);

  title = this.config.data?.title ?? '確認';
  message = this.config.data?.message ?? '確定要繼續嗎？';

  onConfirm() {
    this.dialogRef.close(true);
  }

  onCancel() {
    this.dialogRef.close(false);
  }
}
