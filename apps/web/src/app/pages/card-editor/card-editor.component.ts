import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { form, FormField, required, submit } from '@angular/forms/signals';
import {
  FmAddItemButtonComponent,
  FmAlertComponent,
  FmButtonComponent,
  FmFormSectionHeaderComponent,
  FmGlowTextareaComponent,
  FmPageHeaderComponent
} from '@flashmind/ui';
import { FmMeaningEditorCardComponent, MeaningDraft } from './components/meaning-editor-card/meaning-editor-card.component';
import { CardStore } from '../../components/card/card.store';
import { CardMeaningDraft, canDeleteMeaning, createEmptyMeaning } from '../../components/card/card.domain';
import { validateMeaningsForSubmit } from '../../components/card/card.form';
import { AiStore } from '../../components/ai/ai.store';
import { canGenerateContent } from '../../components/ai/ai.domain';
import { TtsStore } from '../../components/tts/tts.store';

interface MeaningBlock {
  id: string;
  label: string;
  data: MeaningDraft;
}

@Component({
  selector: 'app-card-editor-page',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmFormSectionHeaderComponent,
    FmGlowTextareaComponent,
    FmMeaningEditorCardComponent,
    FmAddItemButtonComponent,
    FmAlertComponent,
    FormField
  ],
  templateUrl: './card-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardEditorComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cardStore = inject(CardStore);
  private readonly aiStore = inject(AiStore);
  private readonly ttsStore = inject(TtsStore);

  readonly deckId = signal('');
  readonly cardId = signal<string | null>(null);
  readonly isEditMode = computed(() => !!this.cardId());
  readonly pageTitle = computed(() => this.isEditMode() ? '編輯快閃卡' : '新增快閃卡');

  // Signal Forms model
  readonly formModel = signal({ front: '' });
  readonly cardForm = form(this.formModel, (f) => {
    required(f.front, { message: '請輸入正面內容' });
  });

  // 詞義使用獨立 signal 管理（動態陣列）
  readonly meanings = signal<CardMeaningDraft[]>([createEmptyMeaning()]);

  readonly meaningBlocks = computed<MeaningBlock[]>(() => {
    return this.meanings().map((m, i) => ({
      id: `meaning-${i}`,
      label: m.zhMeaning || `詞義 ${i + 1}`,
      data: m
    }));
  });

  readonly canDeleteMeanings = computed(() => canDeleteMeaning(this.meanings().length));
  readonly loading = this.cardStore.loading;
  readonly error = signal<string | null>(null);

  // AI 生成狀態
  readonly aiGenerating = this.aiStore.generating;
  readonly canAiGenerate = computed(() => canGenerateContent(this.formModel().front));

  // TTS 播放狀態
  readonly ttsPlayingText = this.ttsStore.playingText;

  ngOnInit() {
    const deckId = this.route.snapshot.paramMap.get('deckId');
    const cardId = this.route.snapshot.paramMap.get('cardId');

    if (deckId) {
      this.deckId.set(deckId);
    }
    if (cardId) {
      this.cardId.set(cardId);
      this.loadCard(deckId!, cardId);
    }
  }

  private async loadCard(deckId: string, cardId: string) {
    await this.cardStore.loadCard(deckId, cardId);
    const card = this.cardStore.currentCard();
    if (card) {
      this.formModel.set({ front: card.front });
      this.meanings.set(
        card.meanings.map((m) => ({
          zhMeaning: m.zhMeaning,
          enExample: m.enExample ?? '',
          zhExample: m.zhExample ?? ''
        }))
      );
    }
  }

  onMeaningChange(index: number, meaning: MeaningDraft) {
    const updated = [...this.meanings()];
    updated[index] = meaning;
    this.meanings.set(updated);
  }

  onDeleteMeaning(index: number) {
    if (!this.canDeleteMeanings()) return;
    const updated = this.meanings().filter((_, i) => i !== index);
    this.meanings.set(updated);
  }

  onAddMeaning() {
    this.meanings.update((list) => [...list, createEmptyMeaning()]);
  }

  async onAiGenerate() {
    if (!this.canAiGenerate() || this.aiGenerating()) return;

    this.error.set(null);
    const frontText = this.formModel().front.trim();
    const meanings = await this.aiStore.generateCardContent(frontText);

    if (meanings) {
      this.meanings.set(meanings);
    } else {
      this.error.set(this.aiStore.error() ?? 'AI 生成失敗');
    }
  }

  onPlayWordAudio(text: string) {
    if (!text.trim()) return;
    void this.ttsStore.playWord(text);
  }

  onPlaySentenceAudio(text: string) {
    if (!text.trim()) return;
    void this.ttsStore.play(text);
  }

  isPlayingAudio(text: string): boolean {
    return this.ttsStore.isPlaying(text);
  }

  async onSave() {
    this.error.set(null);

    // 使用 Signal Forms submit 驗證
    await submit(this.cardForm, async () => {
      // 驗證詞義
      const meaningsError = validateMeaningsForSubmit(this.meanings());
      if (meaningsError) {
        this.error.set(meaningsError);
        return;
      }

      const requestData = {
        front: this.formModel().front.trim(),
        meanings: this.meanings().map((m) => ({
          zhMeaning: m.zhMeaning,
          enExample: m.enExample || undefined,
          zhExample: m.zhExample || undefined
        }))
      };

      if (this.isEditMode()) {
        const success = await this.cardStore.updateCard(this.deckId(), this.cardId()!, requestData);
        if (success) {
          this.navigateBack();
        } else {
          this.error.set(this.cardStore.error() ?? '更新失敗');
        }
      } else {
        const cardId = await this.cardStore.createCard(this.deckId(), requestData);
        if (cardId) {
          this.navigateBack();
        } else {
          this.error.set(this.cardStore.error() ?? '建立失敗');
        }
      }
    }).catch(() => {
      // 驗證失敗時不做額外處理，錯誤已顯示在表單欄位
    });
  }

  onCancel() {
    this.navigateBack();
  }

  private navigateBack() {
    void this.router.navigate(['/decks', this.deckId()]);
  }
}
