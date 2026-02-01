import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FmButtonComponent,
  FmIconButtonComponent,
  FmLabeledInputComponent,
  FmNumberInputRowComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent,
  FmConfirmDialogComponent,
  DialogService
} from '@flashmind/ui';
import { DecksService } from '@flashmind/api-client';

/** 學習步驟格式驗證器 */
function learningStepsValidator(control: FormControl): { [key: string]: boolean } | null {
  const value = control.value as string;
  if (!value || value.trim().length === 0) {
    return null;
  }
  const stepPattern = /^\d+[mhd]$/;
  const steps = value.split(',').map((s: string) => s.trim());
  const valid = steps.every((step: string) => {
    if (!stepPattern.test(step)) return false;
    const num = parseInt(step.slice(0, -1), 10);
    return num > 0;
  });
  return valid ? null : { invalidLearningSteps: true };
}

/** FSRS 預設值 */
const FSRS_DEFAULTS = {
  learningSteps: '1m,10m',
  relearningSteps: '10m',
  requestRetention: 0.9,
  maximumInterval: 36500,
};

@Component({
  selector: 'app-deck-settings-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmLabeledInputComponent,
    FmSectionHeadingComponent,
    FmNumberInputRowComponent,
    FmButtonComponent,
    RouterLink,
    ReactiveFormsModule
  ],
  templateUrl: './deck-settings.component.html',
  styleUrl: './deck-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckSettingsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly decksService = inject(DecksService);
  private readonly dialogService = inject(DialogService);

  readonly deckNameControl = new FormControl('', [Validators.required, Validators.maxLength(100)]);
  readonly dailyNewCardsControl = new FormControl(20);
  readonly dailyReviewCardsControl = new FormControl(100);
  readonly dailyResetHourControl = new FormControl(4);
  readonly enableReverse = signal(false);

  // FSRS 演算法參數
  readonly requestRetentionControl = new FormControl(FSRS_DEFAULTS.requestRetention, [
    Validators.min(0.70),
    Validators.max(0.97),
  ]);
  readonly maximumIntervalControl = new FormControl(FSRS_DEFAULTS.maximumInterval, [
    Validators.min(30),
    Validators.max(36500),
  ]);
  readonly learningStepsControl = new FormControl(FSRS_DEFAULTS.learningSteps, [
    learningStepsValidator as any,
  ]);
  readonly relearningStepsControl = new FormControl(FSRS_DEFAULTS.relearningSteps, [
    learningStepsValidator as any,
  ]);

  readonly deckId = signal('');
  readonly deckName = signal('');
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly isDeleting = signal(false);
  readonly errorMessage = signal('');

  get isFormValid(): boolean {
    return this.deckNameControl.valid
      && !!this.deckNameControl.value?.trim()
      && !this.learningStepsControl.errors
      && !this.relearningStepsControl.errors
      && !this.requestRetentionControl.errors
      && !this.maximumIntervalControl.errors;
  }

  /** 格式化保留率為百分比顯示 */
  get retentionPercent(): string {
    const val = this.requestRetentionControl.value;
    return val != null ? `${Math.round(val * 100)}%` : '90%';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.deckId.set(id);
      this.loadDeck(id);
    }
  }

  private loadDeck(id: string) {
    this.isLoading.set(true);
    this.decksService.getDeck(id).subscribe({
      next: (response) => {
        const deck = response.data;
        this.deckName.set(deck.name);
        this.deckNameControl.setValue(deck.name);
        this.dailyNewCardsControl.setValue(deck.dailyNewCards);
        this.dailyReviewCardsControl.setValue(deck.dailyReviewCards);
        this.dailyResetHourControl.setValue(deck.dailyResetHour);

        // 載入 FSRS 參數
        this.learningStepsControl.setValue(deck.learningSteps ?? FSRS_DEFAULTS.learningSteps);
        this.relearningStepsControl.setValue(deck.relearningSteps ?? FSRS_DEFAULTS.relearningSteps);
        this.requestRetentionControl.setValue(deck.requestRetention ?? FSRS_DEFAULTS.requestRetention);
        this.maximumIntervalControl.setValue(deck.maximumInterval ?? FSRS_DEFAULTS.maximumInterval);

        // 載入反向學習設定
        this.enableReverse.set(deck.enableReverse ?? false);

        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('載入牌組失敗');
      }
    });
  }

  onSave() {
    if (!this.isFormValid) {
      this.errorMessage.set('請檢查表單欄位是否正確');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.decksService.updateDeck(this.deckId(), {
      name: this.deckNameControl.value!.trim(),
      dailyNewCards: this.dailyNewCardsControl.value ?? 20,
      dailyReviewCards: this.dailyReviewCardsControl.value ?? 100,
      dailyResetHour: this.dailyResetHourControl.value ?? 4,
      learningSteps: this.learningStepsControl.value ?? FSRS_DEFAULTS.learningSteps,
      relearningSteps: this.relearningStepsControl.value ?? FSRS_DEFAULTS.relearningSteps,
      requestRetention: this.requestRetentionControl.value ?? FSRS_DEFAULTS.requestRetention,
      maximumInterval: this.maximumIntervalControl.value ?? FSRS_DEFAULTS.maximumInterval,
      enableReverse: this.enableReverse(),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/decks', this.deckId()]);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('更新牌組失敗，請稍後再試');
      }
    });
  }

  onToggleEnableReverse() {
    this.enableReverse.update((v) => !v);
  }

  onResetFsrsDefaults() {
    this.learningStepsControl.setValue(FSRS_DEFAULTS.learningSteps);
    this.relearningStepsControl.setValue(FSRS_DEFAULTS.relearningSteps);
    this.requestRetentionControl.setValue(FSRS_DEFAULTS.requestRetention);
    this.maximumIntervalControl.setValue(FSRS_DEFAULTS.maximumInterval);
  }

  onDelete() {
    const dialogRef = this.dialogService.open(FmConfirmDialogComponent, {
      data: {
        title: '刪除牌組',
        message: `確定要刪除「${this.deckName()}」嗎？此操作將刪除所有卡片與學習紀錄，且無法復原。`,
        confirmLabel: '確認刪除',
        cancelLabel: '取消'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.performDelete();
      }
    });
  }

  private performDelete() {
    this.isDeleting.set(true);
    this.decksService.deleteDeck(this.deckId()).subscribe({
      next: () => {
        this.isDeleting.set(false);
        void this.router.navigate(['/decks']);
      },
      error: () => {
        this.isDeleting.set(false);
        this.errorMessage.set('刪除牌組失敗，請稍後再試');
      }
    });
  }

  onCancel() {
    void this.router.navigate(['/decks', this.deckId()]);
  }
}
