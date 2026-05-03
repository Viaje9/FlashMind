import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  FmAddItemButtonComponent,
  FmButtonComponent,
  FmIconButtonComponent,
  FmPageHeaderComponent,
} from '@flashmind/ui';
import { CollectionSuggestionCardComponent } from '../../components/collection-pack/collection-suggestion-card.component';
import { CollectionSuggestedCardComponent } from '../../components/collection-pack/collection-suggested-card.component';
import {
  readStoredCollectionDeckId,
  removeStoredCollectionDeckId,
  resolveStoredCollectionDeckId,
  type CollectionDeckOption,
  type CollectionSuggestion,
  type CollectionSuggestedCard,
  writeStoredCollectionDeckId,
} from '../../components/collection-pack/collection-pack.domain';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';
import {
  FmMeaningEditorCardComponent,
  type MeaningDraft,
} from '../card-editor/components/meaning-editor-card/meaning-editor-card.component';
import { canDeleteMeaning, createEmptyMeaning } from '../../components/card/card.domain';
import { validateMeaningsForSubmit } from '../../components/card/card.form';
import { AiStore } from '../../components/ai/ai.store';
import { canGenerateContent } from '../../components/ai/ai.domain';
import { TtsStore } from '../../components/tts/tts.store';

@Component({
  selector: 'app-collection-pack-new-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    FmButtonComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    FmAddItemButtonComponent,
    CollectionSuggestionCardComponent,
    CollectionSuggestedCardComponent,
    FmMeaningEditorCardComponent,
  ],
  templateUrl: './collection-pack-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPackNewComponent {
  private readonly router = inject(Router);
  private readonly aiStore = inject(AiStore);
  private readonly ttsStore = inject(TtsStore);
  readonly store = inject(CollectionPackStore);
  readonly inputControl = new FormControl('', {
    nonNullable: true,
  });
  readonly inputValue = signal(this.inputControl.value);
  readonly deckPickerContext = signal<{
    groupId: string;
    suggestedCard: CollectionSuggestedCard;
  } | null>(null);
  readonly flashcardContext = signal<{
    groupId: string;
    suggestedCard: CollectionSuggestedCard;
    deck: CollectionDeckOption;
  } | null>(null);
  readonly selectedDeckId = signal<string | null>(null);
  readonly deckPickerNotice = signal<string | null>(null);
  readonly flashcardFront = signal('');
  readonly flashcardMeanings = signal<MeaningDraft[]>([createEmptyMeaning()]);
  readonly flashcardError = signal<string | null>(null);
  readonly canDeleteFlashcardMeanings = computed(() =>
    canDeleteMeaning(this.flashcardMeanings().length),
  );
  readonly flashcardAiGenerating = this.aiStore.generating;
  readonly canFlashcardAiGenerate = computed(() => canGenerateContent(this.flashcardFront()));

  constructor() {
    this.inputControl.valueChanges.subscribe((value) => this.inputValue.set(value));
  }

  async onSubmit(): Promise<void> {
    const value = this.inputValue().trim();
    if (!value) return;

    this.deckPickerNotice.set(null);
    const sendMessage = this.store.sendChatMessage(value);
    this.inputControl.setValue('');
    setTimeout(() => this.scrollChatBottom());
    await sendMessage;
    this.scrollToLastSuggestion();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) {
      return;
    }

    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    void this.onSubmit();
  }

  private scrollChatBottom(): void {
    const bottom = document.querySelector('[data-collection-chat-bottom]');
    if (bottom instanceof HTMLElement && typeof bottom.scrollIntoView === 'function') {
      bottom.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }

  private scrollToLastSuggestion(): void {
    setTimeout(() => {
      const suggestions = document.querySelectorAll('app-collection-suggestion-card');
      const lastSuggestion = suggestions.item(suggestions.length - 1);
      if (
        lastSuggestion instanceof HTMLElement &&
        typeof lastSuggestion.scrollIntoView === 'function'
      ) {
        lastSuggestion.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  async onToggleSuggestion(groupId: string, suggestion: CollectionSuggestion): Promise<void> {
    if (suggestion.added) {
      await this.store.removeSuggestion(groupId, suggestion.id);
      return;
    }

    await this.store.addSuggestion(groupId, suggestion.id);
  }

  async onAddSuggestedCard(groupId: string, suggestedCard: CollectionSuggestedCard): Promise<void> {
    this.deckPickerNotice.set(null);
    await this.store.loadDeckOptions();
    const decks = this.store.deckOptions();
    if (decks.length === 0) {
      this.deckPickerNotice.set('目前還沒有可加入的牌組，請先建立牌組後再新增單字。');
      return;
    }

    const storedDeckId = resolveStoredCollectionDeckId(
      readStoredCollectionDeckId(this.getLocalStorage()),
      decks,
    );

    if (!storedDeckId && readStoredCollectionDeckId(this.getLocalStorage())) {
      removeStoredCollectionDeckId(this.getLocalStorage());
    }

    this.selectedDeckId.set(storedDeckId ?? decks[0].id);
    this.deckPickerContext.set({ groupId, suggestedCard });
  }

  onSelectDeck(deckId: string): void {
    this.selectedDeckId.set(deckId);
  }

  onCancelDeckPicker(): void {
    this.deckPickerContext.set(null);
  }

  onConfirmDeckPicker(): void {
    const context = this.deckPickerContext();
    const deck = this.store.deckOptions().find((item) => item.id === this.selectedDeckId());
    if (!context || !deck) return;

    writeStoredCollectionDeckId(this.getLocalStorage(), deck.id);
    this.deckPickerNotice.set(null);
    this.deckPickerContext.set(null);
    this.openFlashcardForm(context.groupId, context.suggestedCard, deck);
  }

  onCancelFlashcard(): void {
    this.flashcardContext.set(null);
    this.flashcardError.set(null);
  }

  onFlashcardMeaningChange(index: number, meaning: MeaningDraft): void {
    const updated = [...this.flashcardMeanings()];
    updated[index] = meaning;
    this.flashcardMeanings.set(updated);
  }

  onDeleteFlashcardMeaning(index: number): void {
    if (!this.canDeleteFlashcardMeanings()) return;
    this.flashcardMeanings.update((meanings) =>
      meanings.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  onAddFlashcardMeaning(): void {
    this.flashcardMeanings.update((meanings) => [...meanings, createEmptyMeaning()]);
  }

  onPlayFlashcardSentenceAudio(text: string): void {
    if (!text.trim()) return;
    void this.ttsStore.play(text);
  }

  isFlashcardSentenceAudioPlaying(text: string): boolean {
    return this.ttsStore.isPlaying(text);
  }

  async onFlashcardAiGenerate(): Promise<void> {
    if (!this.canFlashcardAiGenerate() || this.flashcardAiGenerating()) return;

    this.flashcardError.set(null);
    const meanings = await this.aiStore.generateCardContent(this.flashcardFront().trim());

    if (meanings) {
      this.flashcardMeanings.set(meanings);
      return;
    }

    this.flashcardError.set(this.aiStore.error() ?? 'AI 生成失敗');
  }

  async onSaveFlashcard(): Promise<void> {
    const context = this.flashcardContext();
    if (!context) return;

    const front = this.flashcardFront().trim();
    if (!front) {
      this.flashcardError.set('請輸入正面內容');
      return;
    }

    const meaningsError = validateMeaningsForSubmit(this.flashcardMeanings());
    if (meaningsError) {
      this.flashcardError.set(meaningsError);
      return;
    }

    this.flashcardError.set(null);
    const success = await this.store.addSuggestedCard(
      context.groupId,
      context.suggestedCard.id,
      context.deck,
      {
        front,
        meanings: this.flashcardMeanings(),
      },
    );

    if (success) {
      this.flashcardContext.set(null);
    }
  }

  onStartNewChat(): void {
    this.store.startNewChat();
    this.inputControl.setValue('');
    this.deckPickerNotice.set(null);
  }

  onHeaderTitleClick(): void {
    void this.router.navigate(['/collections']);
  }

  private openFlashcardForm(
    groupId: string,
    suggestedCard: CollectionSuggestedCard,
    deck: CollectionDeckOption,
  ): void {
    this.flashcardFront.set(suggestedCard.front);
    this.flashcardMeanings.set(
      suggestedCard.meanings.map((meaning) => ({
        zhMeaning: meaning.zhMeaning,
        enExample: meaning.enExample,
        zhExample: meaning.zhExample,
      })),
    );
    this.flashcardError.set(null);
    this.flashcardContext.set({ groupId, suggestedCard, deck });
  }

  private getLocalStorage(): Storage | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  }
}
