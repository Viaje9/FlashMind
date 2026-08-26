import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DecksService,
  type DeckListItem,
  type TargetVocabularyItem,
  TargetVocabularyService,
} from '@flashmind/api-client';
import {
  DIALOG_CONFIG,
  DialogRef,
  FmButtonComponent,
  FmDialogActionsComponent,
  FmDialogComponent,
  FmDialogContentComponent,
  FmDialogTitleComponent,
  FmGlowTextareaComponent,
  FmLabeledInputComponent,
  type DialogConfig,
} from '@flashmind/ui';

export interface AddToDeckDialogData {
  item: TargetVocabularyItem;
}

@Component({
  selector: 'app-add-target-vocabulary-to-deck-dialog',
  imports: [
    ReactiveFormsModule,
    FmDialogComponent,
    FmDialogTitleComponent,
    FmDialogContentComponent,
    FmDialogActionsComponent,
    FmButtonComponent,
    FmLabeledInputComponent,
    FmGlowTextareaComponent,
  ],
  template: `
    <fm-dialog>
      <fm-dialog-title>加入牌組</fm-dialog-title>
      <fm-dialog-content>
        <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="onConfirm()">
          <div class="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
            <p class="text-xs font-bold tracking-wider text-primary">已在口說中使用</p>
            <p class="mt-1 text-xl font-black text-slate-900 dark:text-white">
              {{ item.term }}
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              送出前可以調整卡片內容；若牌組已有同字卡，只會建立連結。
            </p>
          </div>

          <label class="flex flex-col gap-2">
            <span class="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">牌組</span>
            <select
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-medium text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 dark:border-white/5 dark:bg-surface-dark dark:text-white"
              formControlName="deckId"
              data-testid="target-vocabulary-add-deck-select"
            >
              @if (loadingDecks()) {
                <option value="">正在載入牌組...</option>
              } @else if (decks().length === 0) {
                <option value="">目前沒有可用牌組</option>
              } @else {
                @for (deck of decks(); track deck.id) {
                  <option [value]="deck.id">{{ deck.name }}</option>
                }
              }
            </select>
          </label>

          <fm-labeled-input
            label="單字或片語"
            formControlName="term"
            ariaLabel="單字或片語"
            testId="target-vocabulary-add-term"
          />
          <fm-labeled-input
            label="中文意思"
            formControlName="zhMeaning"
            ariaLabel="中文意思"
            testId="target-vocabulary-add-meaning"
          />

          <label class="flex flex-col gap-2">
            <span class="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">自然句子</span>
            <fm-glow-textarea
              formControlName="naturalSentence"
              placeholder="保留這次 Review 整理出的自然說法"
              minHeightClass="min-h-[110px]"
              [maxLength]="2000"
              ariaLabel="自然句子"
              testId="target-vocabulary-add-sentence"
            />
          </label>

          @if (error()) {
            <p class="text-sm text-red-500" data-testid="target-vocabulary-add-error">
              {{ error() }}
            </p>
          }
        </form>
      </fm-dialog-content>
      <fm-dialog-actions>
        <fm-button
          variant="ghost"
          [disabled]="submitting()"
          (click)="onCancel()"
          testId="target-vocabulary-add-cancel"
        >
          取消
        </fm-button>
        <fm-button
          variant="primary"
          [disabled]="form.invalid || loadingDecks() || decks().length === 0 || submitting()"
          (click)="onConfirm()"
          testId="target-vocabulary-add-confirm"
        >
          {{ submitting() ? '加入中...' : '加入牌組' }}
        </fm-button>
      </fm-dialog-actions>
    </fm-dialog>
  `,
  styles: `
    :host fm-dialog-content {
      min-height: 0;
      overflow: hidden;
    }

    :host fm-dialog-actions {
      flex: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToDeckDialogComponent implements OnInit {
  private readonly decksApi = inject(DecksService);
  private readonly targetVocabularyApi = inject(TargetVocabularyService);
  private readonly dialogRef =
    inject<DialogRef<AddToDeckDialogComponent, TargetVocabularyItem>>(DialogRef);
  private readonly config = inject(DIALOG_CONFIG) as DialogConfig<AddToDeckDialogData>;

  readonly item = this.config.data!.item;
  readonly decks = signal<DeckListItem[]>([]);
  readonly loadingDecks = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    deckId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    term: new FormControl(this.item.term, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    zhMeaning: new FormControl(this.item.zhMeaning, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000)],
    }),
    naturalSentence: new FormControl(this.item.naturalSentence ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
  });

  ngOnInit(): void {
    this.decksApi.listDecks().subscribe({
      next: ({ data }) => {
        this.decks.set(data);
        if (data.length > 0) this.form.controls.deckId.setValue(data[0].id);
        this.loadingDecks.set(false);
      },
      error: () => {
        this.error.set('牌組載入失敗，請稍後再試');
        this.loadingDecks.set(false);
      },
    });
  }

  onConfirm(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set('');
    this.targetVocabularyApi
      .addTargetVocabularyToDeck(this.item.id, {
        deckId: value.deckId,
        term: value.term.trim(),
        zhMeaning: value.zhMeaning.trim(),
        naturalSentence: value.naturalSentence.trim() || undefined,
      })
      .subscribe({
        next: ({ data }) => this.dialogRef.close(data),
        error: () => {
          this.error.set('加入牌組失敗，請稍後再試');
          this.submitting.set(false);
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
