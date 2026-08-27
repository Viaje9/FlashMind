import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DecksService,
  SpeakingService,
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
  type DialogConfig,
} from '@flashmind/ui';
import { firstValueFrom } from 'rxjs';
import { FlashcardEditorFieldsComponent } from '../../../../components/card/flashcard-editor-fields/flashcard-editor-fields.component';
import { createEmptyMeaning } from '../../../../components/card/card.domain';
import type { MeaningDraft } from '../../../card-editor/components/meaning-editor-card/meaning-editor-card.component';
import { TtsStore } from '../../../../components/tts/tts.store';
import {
  readStoredTargetVocabularyDeckId,
  resolveStoredTargetVocabularyDeckId,
  writeStoredTargetVocabularyDeckId,
} from '../../../../components/target-vocabulary/target-vocabulary.domain';

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
    FlashcardEditorFieldsComponent,
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

          <app-flashcard-editor-fields
            [front]="front()"
            [meanings]="meanings()"
            [showTranslate]="true"
            [showAddMeaning]="false"
            [translatingIndex]="translatingIndex()"
            [playingText]="ttsStore.playingText()"
            (frontChange)="front.set($event)"
            (meaningChange)="onMeaningChange($event)"
            (deleteMeaning)="onDeleteMeaning($event)"
            (addMeaning)="onAddMeaning()"
            (playSentence)="onPlaySentence($event)"
            (translateSentence)="onTranslateSentence($event)"
          />

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
          [disabled]="
            form.invalid || !isCardValid() || loadingDecks() || decks().length === 0 || submitting()
          "
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
      overflow-y: auto;
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
  private readonly speakingApi = inject(SpeakingService);
  readonly ttsStore = inject(TtsStore);
  private readonly dialogRef =
    inject<DialogRef<AddToDeckDialogComponent, TargetVocabularyItem>>(DialogRef);
  private readonly config = inject(DIALOG_CONFIG) as DialogConfig<AddToDeckDialogData>;

  readonly item = this.config.data!.item;
  readonly decks = signal<DeckListItem[]>([]);
  readonly loadingDecks = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly front = signal(this.item.term);
  readonly meanings = signal<MeaningDraft[]>([
    {
      ...createEmptyMeaning(),
      zhMeaning: this.item.zhMeaning,
      enExample: this.item.naturalSentence ?? '',
    },
  ]);
  readonly translatingIndex = signal<number | null>(null);
  readonly form = new FormGroup({
    deckId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  isCardValid(): boolean {
    return (
      !!this.front().trim() &&
      this.front().length <= 200 &&
      this.meanings().length > 0 &&
      this.meanings().every(
        (meaning) =>
          !!meaning.zhMeaning.trim() &&
          meaning.zhMeaning.length <= 1000 &&
          meaning.enExample.length <= 2000 &&
          meaning.zhExample.length <= 2000,
      )
    );
  }

  onMeaningChange(event: { index: number; meaning: MeaningDraft }): void {
    this.meanings.update((meanings) =>
      meanings.map((meaning, index) => (index === event.index ? event.meaning : meaning)),
    );
  }

  onDeleteMeaning(index: number): void {
    if (this.meanings().length <= 1) return;
    this.meanings.update((meanings) => meanings.filter((_, itemIndex) => itemIndex !== index));
  }

  onAddMeaning(): void {
    this.meanings.update((meanings) => [...meanings, createEmptyMeaning()]);
  }

  onPlaySentence(text: string): void {
    if (text.trim()) void this.ttsStore.play(text);
  }

  async onTranslateSentence(index: number): Promise<void> {
    const meaning = this.meanings()[index];
    if (!meaning?.enExample.trim() || this.translatingIndex() !== null) return;

    this.translatingIndex.set(index);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.speakingApi.translateSpeakingText({ text: meaning.enExample.trim() }),
      );
      this.onMeaningChange({
        index,
        meaning: { ...meaning, zhExample: response.data.translatedText.trim() },
      });
    } catch {
      this.error.set('例句翻譯失敗，請稍後再試');
    } finally {
      this.translatingIndex.set(null);
    }
  }

  ngOnInit(): void {
    this.decksApi.listDecks().subscribe({
      next: ({ data }) => {
        this.decks.set(data);
        const storedDeckId = resolveStoredTargetVocabularyDeckId(
          readStoredTargetVocabularyDeckId(this.getLocalStorage()),
          data,
        );
        if (data.length > 0) {
          this.form.controls.deckId.setValue(storedDeckId ?? data[0].id);
        }
        this.loadingDecks.set(false);
      },
      error: () => {
        this.error.set('牌組載入失敗，請稍後再試');
        this.loadingDecks.set(false);
      },
    });
  }

  onConfirm(): void {
    if (this.form.invalid || !this.isCardValid() || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const meaning = this.meanings()[0];
    this.submitting.set(true);
    this.error.set('');
    this.targetVocabularyApi
      .addTargetVocabularyToDeck(this.item.id, {
        deckId: value.deckId,
        term: this.front().trim(),
        zhMeaning: meaning.zhMeaning.trim(),
        naturalSentence: meaning.enExample.trim() || undefined,
        zhExample: meaning.zhExample.trim() || undefined,
      })
      .subscribe({
        next: ({ data }) => {
          writeStoredTargetVocabularyDeckId(this.getLocalStorage(), value.deckId);
          this.dialogRef.close(data);
        },
        error: () => {
          this.error.set('加入牌組失敗，請稍後再試');
          this.submitting.set(false);
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private getLocalStorage(): Storage | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  }
}
