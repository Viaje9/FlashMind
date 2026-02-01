import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FmButtonComponent,
  FmIconButtonComponent,
  FmLabeledInputComponent,
  FmNumberInputRowComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent
} from '../../../../../../packages/ui/src/index';
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
  selector: 'app-deck-create-page',
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
  templateUrl: './deck-create.component.html',
  styleUrl: './deck-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckCreateComponent {
  private readonly router = inject(Router);
  private readonly decksService = inject(DecksService);

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

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  get isFormValid(): boolean {
    return this.deckNameControl.valid
      && !!this.deckNameControl.value?.trim()
      && !this.learningStepsControl.errors
      && !this.relearningStepsControl.errors
      && !this.requestRetentionControl.errors
      && !this.maximumIntervalControl.errors;
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

  onSave() {
    if (!this.isFormValid) {
      this.errorMessage.set('請檢查表單欄位是否正確');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.decksService.createDeck({
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
      next: (response) => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/decks', response.data.id]);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('建立牌組失敗，請稍後再試');
      }
    });
  }

  onCancel() {
    void this.router.navigate(['/decks']);
  }
}
