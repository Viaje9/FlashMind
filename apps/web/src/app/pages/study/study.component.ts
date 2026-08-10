import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import type { RelatedExample } from '@flashmind/api-client';
import { ActivatedRoute, Router } from '@angular/router';
import { FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { FmStudyCardComponent, StudyExample } from './components/study-card/study-card.component';
import { StudyAssistantPanelComponent } from './components/study-assistant-panel/study-assistant-panel.component';
import { StudyNotePanelComponent } from './components/study-note-panel/study-note-panel.component';
import { FmStudyProgressComponent } from './components/study-progress/study-progress.component';
import { FmSwipeableCardComponent } from './components/swipeable-card/swipeable-card.component';
import { StudyStore } from '../../components/study/study.store';
import { TtsStore } from '../../components/tts/tts.store';
import {
  mapMeaningsToExamples,
  getStudyAutoPlayKey,
  getStudyWord,
  getStudyTranslations,
  StudyRating,
} from '../../components/study/study.domain';

@Component({
  selector: 'app-study-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmStudyProgressComponent,
    FmStudyCardComponent,
    FmSwipeableCardComponent,
    StudyAssistantPanelComponent,
    StudyNotePanelComponent,
  ],
  templateUrl: './study.component.html',
  styleUrl: './study.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly studyStore = inject(StudyStore);
  private readonly ttsStore = inject(TtsStore);

  private deckId = '';

  // Computed from store
  readonly phase = this.studyStore.phase;
  readonly currentCard = this.studyStore.currentCard;
  readonly progress = this.studyStore.progress;
  readonly isFlipped = this.studyStore.isFlipped;
  readonly canUndo = this.studyStore.canUndo;
  readonly isSubmitting = this.studyStore.isSubmitting;
  readonly stats = this.studyStore.stats;
  readonly deckName = this.studyStore.deckName;
  readonly relatedExample = signal<RelatedExample | null>(null);
  readonly relatedExampleLoading = signal(false);
  readonly relatedExampleSaving = signal(false);
  readonly relatedExampleError = signal<string | null>(null);

  readonly word = computed(() => {
    const card = this.currentCard();
    return card ? getStudyWord(card) : '';
  });
  readonly translations = computed(() => {
    const card = this.currentCard();
    return card ? getStudyTranslations(card) : [];
  });
  readonly audioText = computed(() => this.currentCard()?.front ?? '');
  private readonly autoPlayKey = computed(() =>
    getStudyAutoPlayKey(
      this.phase() === 'studying',
      this.isFlipped(),
      this.isSubmitting(),
      this.currentCard(),
    ),
  );
  private readonly autoPlayText = computed(() => {
    const card = this.currentCard();
    if (!card) return '';
    return card.direction === 'REVERSE' ? card.front : getStudyWord(card);
  });
  readonly examples = computed((): StudyExample[] => {
    const card = this.currentCard();
    return card ? mapMeaningsToExamples(card) : [];
  });

  readonly isReverse = computed(() => this.currentCard()?.direction === 'REVERSE');

  readonly isLoading = computed(() => this.phase() === 'loading');
  readonly isStudying = computed(() => this.phase() === 'studying');
  readonly isCompleted = computed(() => this.phase() === 'completed');
  readonly hasError = computed(() => this.phase() === 'error');
  readonly showDecisionBar = computed(() => this.isStudying() && this.isFlipped());

  // 只在卡片或翻面狀態形成新的播放 key 時自動播放，內容更新不重播。
  private readonly autoPlayEffect = effect(() => {
    const autoPlayKey = this.autoPlayKey();
    const autoPlayText = this.autoPlayText();

    if (autoPlayKey && autoPlayText) {
      untracked(() => {
        void this.ttsStore.playWord(autoPlayText);
      });
    }
  });

  // TTS loading 狀態
  readonly wordAudioLoading = computed(() => this.ttsStore.isLoading(this.audioText()));
  readonly exampleAudioLoadingIndex = computed(() => {
    const examples = this.examples();
    for (let i = 0; i < examples.length; i++) {
      if (this.ttsStore.isLoading(examples[i].sentence)) {
        return i;
      }
    }
    return null;
  });
  readonly relatedExampleAudioLoading = computed(() => {
    const example = this.relatedExample();
    return example ? this.ttsStore.isLoading(example.enExample) : false;
  });

  ngOnInit(): void {
    this.deckId = this.route.snapshot.paramMap.get('deckId') ?? '';
    const deckName = this.route.snapshot.queryParamMap.get('name') ?? '學習';

    if (this.deckId) {
      this.studyStore.startStudy(this.deckId, deckName);
    }
  }

  ngOnDestroy(): void {
    this.studyStore.reset();
  }

  onCardClick(): void {
    if (!this.isFlipped() && !this.isSubmitting()) {
      this.studyStore.flipCard();
    }
  }

  onRating(rating: StudyRating): void {
    this.relatedExample.set(null);
    this.relatedExampleError.set(null);
    this.studyStore.submitRating(rating);
  }

  onUndo(): void {
    this.relatedExample.set(null);
    this.relatedExampleError.set(null);
    this.studyStore.undoRating();
  }

  onAudioClick(): void {
    const audioText = this.audioText();
    if (audioText) {
      this.ttsStore.playWord(audioText);
    }
  }

  onExampleAudioClick(index: number): void {
    const example = this.examples()[index];
    if (example?.sentence) {
      this.ttsStore.play(example.sentence);
    }
  }

  onRelatedExampleAudioClick(): void {
    const example = this.relatedExample();
    if (example?.enExample) {
      this.ttsStore.play(example.enExample);
    }
  }

  async onGenerateRelatedExample(): Promise<void> {
    if (this.relatedExampleLoading() || this.relatedExampleSaving()) return;
    this.relatedExampleLoading.set(true);
    this.relatedExampleError.set(null);
    const result = await this.studyStore.generateRelatedExample();
    this.relatedExampleLoading.set(false);
    if (result) {
      this.relatedExample.set(result);
    } else {
      this.relatedExampleError.set('例句產生失敗，請稍後再試');
    }
  }

  async onConfirmRelatedExample(): Promise<void> {
    const example = this.relatedExample();
    if (!example || this.relatedExampleSaving()) return;
    this.relatedExampleSaving.set(true);
    this.relatedExampleError.set(null);
    const saved = await this.studyStore.saveRelatedExample(example);
    this.relatedExampleSaving.set(false);
    if (saved) {
      this.relatedExample.set(null);
    } else {
      this.relatedExampleError.set('加入卡片失敗，請稍後再試');
    }
  }

  onCancelRelatedExample(): void {
    if (!this.relatedExampleLoading() && !this.relatedExampleSaving()) {
      this.relatedExample.set(null);
      this.relatedExampleError.set(null);
    }
  }

  onBackToDeck(): void {
    this.router.navigate(['/decks', this.deckId]);
  }

  onStudyAgain(): void {
    this.relatedExample.set(null);
    this.relatedExampleError.set(null);
    this.studyStore.startStudy(this.deckId, this.deckName());
  }
}
