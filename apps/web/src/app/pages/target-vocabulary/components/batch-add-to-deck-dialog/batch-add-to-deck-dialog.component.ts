import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { applyEach, disabled, form, FormField, maxLength, required } from '@angular/forms/signals';
import {
  DecksService,
  SpeakingService,
  TargetVocabularyService,
  type DeckListItem,
  type TargetVocabularyItem,
} from '@flashmind/api-client';
import {
  DIALOG_CONFIG,
  DialogRef,
  FmAlertComponent,
  FmButtonComponent,
  FmDialogActionsComponent,
  FmDialogComponent,
  FmDialogContentComponent,
  FmDialogTitleComponent,
  type DialogConfig,
} from '@flashmind/ui';
import { firstValueFrom } from 'rxjs';
import {
  readStoredTargetVocabularyDeckId,
  resolveStoredTargetVocabularyDeckId,
  writeStoredTargetVocabularyDeckId,
} from '../../../../components/target-vocabulary/target-vocabulary.domain';

export interface BatchAddToDeckDialogData {
  items: TargetVocabularyItem[];
}

@Component({
  selector: 'app-batch-add-target-vocabulary-to-deck-dialog',
  imports: [
    FormField,
    FmAlertComponent,
    FmButtonComponent,
    FmDialogComponent,
    FmDialogTitleComponent,
    FmDialogContentComponent,
    FmDialogActionsComponent,
  ],
  templateUrl: './batch-add-to-deck-dialog.component.html',
  styleUrl: './batch-add-to-deck-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'onCancel()' },
})
export class BatchAddToDeckDialogComponent implements OnInit {
  private readonly decksApi = inject(DecksService);
  private readonly vocabularyApi = inject(TargetVocabularyService);
  private readonly speakingApi = inject(SpeakingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef =
    inject<DialogRef<BatchAddToDeckDialogComponent, TargetVocabularyItem[]>>(DialogRef);
  private readonly config = inject(DIALOG_CONFIG) as DialogConfig<BatchAddToDeckDialogData>;

  readonly decks = signal<DeckListItem[]>([]);
  readonly loadingDecks = signal(true);
  readonly submitting = signal(false);
  readonly translating = signal(false);
  readonly busy = computed(() => this.submitting() || this.translating());
  readonly error = signal('');
  readonly progress = signal('');
  readonly completed = signal<TargetVocabularyItem[]>([]);
  readonly rowErrors = signal<Record<string, string>>({});
  readonly model = signal({
    deckId: '',
    entries: this.config
      .data!.items.filter((item) => item.status === 'USED')
      .map((item) => ({
        id: item.id,
        term: item.term,
        zhMeaning: item.zhMeaning,
        naturalSentence: item.naturalSentence?.trim() ?? '',
        zhExample: '',
      })),
  });
  readonly batchForm = form(this.model, (path) => {
    required(path.deckId);
    disabled(path.deckId, () => this.busy() || this.loadingDecks() || this.completed().length > 0);
    applyEach(path.entries, (entry) => {
      maxLength(entry.zhExample, 2000);
      disabled(entry.zhExample, () => this.busy());
    });
  });
  readonly pendingEntries = computed(() =>
    this.model().entries.filter((entry) => !this.isCompleted(entry.id)),
  );
  readonly untranslatedCount = computed(
    () =>
      this.pendingEntries().filter((entry) => entry.naturalSentence && !entry.zhExample.trim())
        .length,
  );

  isCompleted(id: string): boolean {
    return this.completed().some((item) => item.id === id);
  }

  async ngOnInit(): Promise<void> {
    try {
      const { data } = await firstValueFrom(this.decksApi.listDecks());
      if (this.destroyRef.destroyed) return;
      this.decks.set(data);
      const storedId = resolveStoredTargetVocabularyDeckId(
        readStoredTargetVocabularyDeckId(this.storage()),
        data,
      );
      this.model.update((model) => ({ ...model, deckId: storedId ?? data[0]?.id ?? '' }));
    } catch {
      this.error.set('牌組載入失敗，請關閉後再試');
    } finally {
      this.loadingDecks.set(false);
    }
  }

  async translateAll(): Promise<void> {
    if (this.busy()) return;
    const entries = this.pendingEntries().filter(
      (entry) => entry.naturalSentence && !entry.zhExample.trim(),
    );
    if (!entries.length) return;
    this.translating.set(true);
    this.error.set('');
    this.rowErrors.set({});
    let failures = 0;
    // 逐句沿用既有翻譯 API，避免一次送出大量請求；保留使用者已填的中文。
    for (const [index, entry] of entries.entries()) {
      if (this.destroyRef.destroyed) break;
      this.progress.set(`翻譯例句 ${index + 1} / ${entries.length}`);
      try {
        const { data } = await firstValueFrom(
          this.speakingApi.translateSpeakingText({ text: entry.naturalSentence }),
        );
        const translation = data.translatedText.trim();
        if (!translation || translation.length > 2000) throw new Error('翻譯長度不符');
        this.model.update((model) => ({
          ...model,
          entries: model.entries.map((current) =>
            current.id === entry.id ? { ...current, zhExample: translation } : current,
          ),
        }));
      } catch {
        failures++;
        this.rowErrors.update((errors) => ({
          ...errors,
          [entry.id]: '翻譯失敗，可重試或自行填寫中文。',
        }));
      }
    }
    this.progress.set('');
    this.translating.set(false);
    if (failures)
      this.error.set(
        `${failures} 個例句翻譯失敗，其他翻譯已保留。再次點擊只會翻譯尚未填寫的例句。`,
      );
  }

  async onConfirm(): Promise<void> {
    const { deckId } = this.model();
    if (
      this.busy() ||
      this.loadingDecks() ||
      this.batchForm().invalid() ||
      !this.decks().some((deck) => deck.id === deckId)
    )
      return;
    const entries = this.pendingEntries();
    if (!entries.length) return;
    this.submitting.set(true);
    this.error.set('');
    this.rowErrors.set({});
    for (const [index, entry] of entries.entries()) {
      if (this.destroyRef.destroyed) break;
      this.progress.set(`加入牌組 ${index + 1} / ${entries.length}`);
      try {
        const { data } = await firstValueFrom(
          this.vocabularyApi.addTargetVocabularyToDeck(entry.id, {
            deckId,
            term: entry.term.trim(),
            zhMeaning: entry.zhMeaning.trim(),
            naturalSentence: entry.naturalSentence || undefined,
            zhExample: entry.zhExample.trim() || undefined,
          }),
        );
        this.completed.update((items) => [...items, data]);
        writeStoredTargetVocabularyDeckId(this.storage(), deckId);
      } catch {
        this.rowErrors.update((errors) => ({ ...errors, [entry.id]: '加入失敗，請再試一次。' }));
      }
    }
    this.submitting.set(false);
    this.progress.set('');
    if (this.destroyRef.destroyed) return;
    if (!this.pendingEntries().length) {
      this.dialogRef.close(this.completed());
    } else {
      this.error.set(
        `已加入 ${this.completed().length} 個，${this.pendingEntries().length} 個未成功。重試只會處理未成功的單字。`,
      );
    }
  }

  onCancel(): void {
    if (!this.busy()) this.dialogRef.close(this.completed());
  }

  private storage(): Storage | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  }
}
