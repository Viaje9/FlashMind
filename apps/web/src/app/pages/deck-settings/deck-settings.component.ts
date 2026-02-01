import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { merge, Observable } from 'rxjs';
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

/** 表單初始值的型別 */
interface DeckFormValues {
  name: string;
  dailyNewCards: number;
  dailyReviewCards: number;
  dailyResetHour: number;
  enableReverse: boolean;
  requestRetention: number;
  maximumInterval: number;
  learningSteps: string;
  relearningSteps: string;
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
  private readonly destroyRef = inject(DestroyRef);

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

  /** 表單載入時的初始值 */
  readonly originalValues = signal<DeckFormValues | null>(null);

  /**
   * 表單版本號，用於觸發 computed signal 重新計算。
   * 每次 FormControl 值變更時遞增，讓 hasUnsavedChanges 能偵測到變化。
   */
  private readonly formVersion = signal(0);

  /** 偵測表單是否有未儲存的變更 */
  readonly hasUnsavedChanges = computed(() => {
    // 依賴 formVersion 以偵測 FormControl 值變更
    this.formVersion();
    // 依賴 enableReverse 以偵測開關變更
    this.enableReverse();

    const original = this.originalValues();
    if (!original) return false;

    return (
      this.deckNameControl.value !== original.name ||
      this.dailyNewCardsControl.value !== original.dailyNewCards ||
      this.dailyReviewCardsControl.value !== original.dailyReviewCards ||
      this.dailyResetHourControl.value !== original.dailyResetHour ||
      this.enableReverse() !== original.enableReverse ||
      this.requestRetentionControl.value !== original.requestRetention ||
      this.maximumIntervalControl.value !== original.maximumInterval ||
      this.learningStepsControl.value !== original.learningSteps ||
      this.relearningStepsControl.value !== original.relearningSteps
    );
  });

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

    // 訂閱所有 FormControl 值變更，遞增 formVersion 以觸發 hasUnsavedChanges 重新計算
    merge(
      this.deckNameControl.valueChanges,
      this.dailyNewCardsControl.valueChanges,
      this.dailyReviewCardsControl.valueChanges,
      this.dailyResetHourControl.valueChanges,
      this.requestRetentionControl.valueChanges,
      this.maximumIntervalControl.valueChanges,
      this.learningStepsControl.valueChanges,
      this.relearningStepsControl.valueChanges,
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.formVersion.update(v => v + 1);
    });
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

        // 儲存初始值供未儲存變更偵測使用
        this.originalValues.set(this.getCurrentFormValues());

        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('載入牌組失敗');
      }
    });
  }

  /** 取得目前表單的所有值 */
  private getCurrentFormValues(): DeckFormValues {
    return {
      name: this.deckNameControl.value ?? '',
      dailyNewCards: this.dailyNewCardsControl.value ?? 20,
      dailyReviewCards: this.dailyReviewCardsControl.value ?? 100,
      dailyResetHour: this.dailyResetHourControl.value ?? 4,
      enableReverse: this.enableReverse(),
      requestRetention: this.requestRetentionControl.value ?? FSRS_DEFAULTS.requestRetention,
      maximumInterval: this.maximumIntervalControl.value ?? FSRS_DEFAULTS.maximumInterval,
      learningSteps: this.learningStepsControl.value ?? FSRS_DEFAULTS.learningSteps,
      relearningSteps: this.relearningStepsControl.value ?? FSRS_DEFAULTS.relearningSteps,
    };
  }

  onSave(): Observable<boolean> {
    if (!this.isFormValid) {
      this.errorMessage.set('請檢查表單欄位是否正確');
      return new Observable<boolean>(subscriber => {
        subscriber.next(false);
        subscriber.complete();
      });
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    return new Observable<boolean>(subscriber => {
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
          // 儲存成功後重置 originalValues
          this.originalValues.set(this.getCurrentFormValues());
          subscriber.next(true);
          subscriber.complete();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('更新牌組失敗，請稍後再試');
          subscriber.next(false);
          subscriber.complete();
        }
      });
    });
  }

  /** 儲存並導航離開 */
  onSaveAndNavigate() {
    this.onSave().subscribe(success => {
      if (success) {
        void this.router.navigate(['/decks', this.deckId()]);
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
        confirmText: '確認刪除',
        cancelText: '取消'
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

  /** 返回按鈕：使用程式化導航，以便 CanDeactivate guard 能攔截 */
  onBack() {
    void this.router.navigate(['/decks', this.deckId()]);
  }

  /** CanDeactivate guard 呼叫的方法 */
  canDeactivate(): Observable<boolean> | boolean {
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    return new Observable<boolean>(subscriber => {
      const dialogRef = this.dialogService.open(FmConfirmDialogComponent, {
        data: {
          title: '尚未儲存',
          message: '設定有未儲存的變更，確定要離開嗎？',
          confirmText: '確定',
          cancelText: '取消'
        }
      });

      dialogRef.afterClosed().subscribe((confirmed) => {
        // 使用者按「確定」→ 捨棄變更直接離開；按「取消」→ 留在頁面
        subscriber.next(!!confirmed);
        subscriber.complete();
      });
    });
  }
}
