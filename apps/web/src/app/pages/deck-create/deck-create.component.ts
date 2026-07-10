import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  FmButtonComponent,
  FmIconButtonComponent,
  FmLabeledInputComponent,
  FmNumberInputRowComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent,
  DialogService,
  FmConfirmDialogComponent,
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

interface DeckImport {
  version: 1;
  name: string;
  dailyNewCards: number;
  dailyReviewCards: number;
  dailyResetHour: number;
  learningSteps: string;
  relearningSteps: string;
  requestRetention: number;
  maximumInterval: number;
  enableReverse: boolean;
  cards: Array<{
    front: string;
    meanings: Array<{
      zhMeaning: string;
      enExample: string | null;
      zhExample: string | null;
      sortOrder: number;
    }>;
  }>;
}

function isDeckImport(value: unknown): value is DeckImport {
  if (!value || typeof value !== 'object') return false;
  const deck = value as Record<string, unknown>;
  return (
    deck['version'] === 1 &&
    typeof deck['name'] === 'string' &&
    [
      'dailyNewCards',
      'dailyReviewCards',
      'dailyResetHour',
      'requestRetention',
      'maximumInterval',
    ].every((key) => typeof deck[key] === 'number') &&
    typeof deck['learningSteps'] === 'string' &&
    typeof deck['relearningSteps'] === 'string' &&
    typeof deck['enableReverse'] === 'boolean' &&
    Array.isArray(deck['cards']) &&
    deck['cards'].every((card: unknown) => {
      if (!card || typeof card !== 'object') return false;
      const candidate = card as Record<string, unknown>;
      return (
        typeof candidate['front'] === 'string' &&
        Array.isArray(candidate['meanings']) &&
        candidate['meanings'].every((meaning: unknown) => {
          if (!meaning || typeof meaning !== 'object') return false;
          const item = meaning as Record<string, unknown>;
          return (
            typeof item['zhMeaning'] === 'string' &&
            (item['enExample'] === null || typeof item['enExample'] === 'string') &&
            (item['zhExample'] === null || typeof item['zhExample'] === 'string') &&
            Number.isInteger(item['sortOrder'])
          );
        })
      );
    })
  );
}

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
    ReactiveFormsModule,
  ],
  templateUrl: './deck-create.component.html',
  styleUrl: './deck-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckCreateComponent {
  private readonly router = inject(Router);
  private readonly decksService = inject(DecksService);
  private readonly http = inject(HttpClient);
  private readonly dialogService = inject(DialogService);

  readonly deckNameControl = new FormControl('', [Validators.required, Validators.maxLength(100)]);
  readonly dailyNewCardsControl = new FormControl(20);
  readonly dailyReviewCardsControl = new FormControl(100);
  readonly dailyResetHourControl = new FormControl(4);
  readonly enableReverse = signal(false);

  // FSRS 演算法參數
  readonly requestRetentionControl = new FormControl(FSRS_DEFAULTS.requestRetention, [
    Validators.min(0.7),
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
    return (
      this.deckNameControl.valid &&
      !!this.deckNameControl.value?.trim() &&
      !this.learningStepsControl.errors &&
      !this.relearningStepsControl.errors &&
      !this.requestRetentionControl.errors &&
      !this.maximumIntervalControl.errors
    );
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

    this.decksService
      .createDeck({
        name: this.deckNameControl.value!.trim(),
        dailyNewCards: this.dailyNewCardsControl.value ?? 20,
        dailyReviewCards: this.dailyReviewCardsControl.value ?? 100,
        dailyResetHour: this.dailyResetHourControl.value ?? 4,
        learningSteps: this.learningStepsControl.value ?? FSRS_DEFAULTS.learningSteps,
        relearningSteps: this.relearningStepsControl.value ?? FSRS_DEFAULTS.relearningSteps,
        requestRetention: this.requestRetentionControl.value ?? FSRS_DEFAULTS.requestRetention,
        maximumInterval: this.maximumIntervalControl.value ?? FSRS_DEFAULTS.maximumInterval,
        enableReverse: this.enableReverse(),
      })
      .subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          void this.router.navigate(['/decks', response.data.id]);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('建立牌組失敗，請稍後再試');
        },
      });
  }

  onCancel() {
    void this.router.navigate(['/decks']);
  }

  async onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const deck: unknown = JSON.parse(await file.text());
      if (!isDeckImport(deck)) throw new Error('invalid');

      const dialogRef = this.dialogService.open(FmConfirmDialogComponent, {
        data: {
          title: '匯入牌組',
          message: `牌組：${deck.name}，共 ${deck.cards.length} 張卡片。確定要匯入嗎？`,
          confirmText: '匯入',
          cancelText: '取消',
        },
      });

      dialogRef.afterClosed().subscribe((confirmed) => {
        if (!confirmed) return;
        this.isSubmitting.set(true);
        this.http.post<{ data: { id: string } }>('/api/decks/import', deck).subscribe({
          next: ({ data }) => void this.router.navigate(['/decks', data.id]),
          error: () => {
            this.isSubmitting.set(false);
            this.errorMessage.set('匯入失敗，請確認 JSON 內容');
          },
        });
      });
    } catch {
      this.errorMessage.set('JSON 格式不符合 FlashMind 牌組匯出格式');
    }
  }
}
