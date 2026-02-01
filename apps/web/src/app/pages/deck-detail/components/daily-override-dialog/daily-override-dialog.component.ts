import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  FmDialogComponent,
  FmDialogTitleComponent,
  FmDialogContentComponent,
  FmDialogActionsComponent,
  FmButtonComponent,
  FmNumberInputRowComponent,
  DialogRef,
  DIALOG_CONFIG
} from '@flashmind/ui';

export interface DailyOverrideDialogData {
  dailyNewCards: number;
  dailyReviewCards: number;
}

export interface DailyOverrideDialogResult {
  newCards: number;
  reviewCards: number;
}

@Component({
  selector: 'fm-daily-override-dialog',
  imports: [
    FmDialogComponent,
    FmDialogTitleComponent,
    FmDialogContentComponent,
    FmDialogActionsComponent,
    FmButtonComponent,
    FmNumberInputRowComponent,
    ReactiveFormsModule,
  ],
  template: `
    <fm-dialog>
      <fm-dialog-title>調整今日上限</fm-dialog-title>
      <fm-dialog-content>
        <div class="flex flex-col gap-4">
          <fm-number-input-row
            [formControl]="newCardsControl"
            title="今日新卡上限"
            icon="add_circle"
            iconClass="bg-blue-500/10 text-blue-500"
            unit="張"
            [min]="minNewCards"
            [step]="5"
            ariaLabel="今日新卡上限"
            testId="deck-detail-override-new-cards"
          />
          <fm-number-input-row
            [formControl]="reviewCardsControl"
            title="今日複習上限"
            icon="refresh"
            iconClass="bg-green-500/10 text-green-500"
            unit="張"
            [min]="minReviewCards"
            [step]="10"
            ariaLabel="今日複習上限"
            testId="deck-detail-override-review-cards"
          />
          <p class="text-xs text-slate-500 dark:text-slate-400">
            覆寫值需大於或等於牌組預設值，隔天自動失效。
          </p>
        </div>
      </fm-dialog-content>
      <fm-dialog-actions>
        <fm-button variant="ghost" (click)="onCancel()" testId="deck-detail-override-cancel">取消</fm-button>
        <fm-button variant="primary" (click)="onConfirm()" testId="deck-detail-override-confirm">確認</fm-button>
      </fm-dialog-actions>
    </fm-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyOverrideDialogComponent {
  private readonly dialogRef = inject<DialogRef<DailyOverrideDialogComponent, DailyOverrideDialogResult>>(DialogRef);
  private readonly config = inject(DIALOG_CONFIG);

  readonly minNewCards = this.config.data?.dailyNewCards ?? 0;
  readonly minReviewCards = this.config.data?.dailyReviewCards ?? 0;

  readonly newCardsControl = new FormControl(this.minNewCards, { nonNullable: true });
  readonly reviewCardsControl = new FormControl(this.minReviewCards, { nonNullable: true });

  onConfirm(): void {
    const newCards = Math.max(this.newCardsControl.value, this.minNewCards);
    const reviewCards = Math.max(this.reviewCardsControl.value, this.minReviewCards);
    this.dialogRef.close({ newCards, reviewCards });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
