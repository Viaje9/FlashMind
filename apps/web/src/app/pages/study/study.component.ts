import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, OnDestroy, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { FmStudyCardComponent, StudyExample } from './components/study-card/study-card.component';
import { FmStudyProgressComponent } from './components/study-progress/study-progress.component';
import { FmSwipeableCardComponent } from './components/swipeable-card/swipeable-card.component';
import { StudyStore } from '../../components/study/study.store';
import { TtsStore } from '../../components/tts/tts.store';
import { mapMeaningsToExamples, getStudyWord, getStudyTranslations, StudyRating } from '../../components/study/study.domain';

@Component({
  selector: 'app-study-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmStudyProgressComponent,
    FmStudyCardComponent,
    FmSwipeableCardComponent,
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

  readonly word = computed(() => {
    const card = this.currentCard();
    return card ? getStudyWord(card) : '';
  });
  readonly translations = computed(() => {
    const card = this.currentCard();
    return card ? getStudyTranslations(card) : [];
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

  // 正向卡：正面顯示時自動播放單字發音
  private readonly forwardAutoPlayEffect = effect(() => {
    const phase = this.phase();
    const flipped = this.isFlipped();
    const submitting = this.isSubmitting();
    const card = this.currentCard();
    const word = this.word();

    if (phase === 'studying' && !flipped && !submitting && word && card?.direction === 'FORWARD') {
      untracked(() => {
        void this.ttsStore.playWord(word);
      });
    }
  });

  // 反向卡：翻開時自動播放英文單字發音
  private readonly reverseAutoPlayEffect = effect(() => {
    const phase = this.phase();
    const flipped = this.isFlipped();
    const card = this.currentCard();

    if (phase === 'studying' && flipped && card?.direction === 'REVERSE') {
      untracked(() => {
        void this.ttsStore.playWord(card.front);
      });
    }
  });

  // TTS loading 狀態
  readonly wordAudioLoading = computed(() => this.ttsStore.isLoading(this.word()));
  readonly exampleAudioLoadingIndex = computed(() => {
    const examples = this.examples();
    for (let i = 0; i < examples.length; i++) {
      if (this.ttsStore.isLoading(examples[i].sentence)) {
        return i;
      }
    }
    return null;
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
    this.studyStore.submitRating(rating);
  }

  onUndo(): void {
    this.studyStore.undoRating();
  }

  onAudioClick(): void {
    const word = this.word();
    if (word) {
      this.ttsStore.playWord(word);
    }
  }

  onExampleAudioClick(index: number): void {
    const example = this.examples()[index];
    if (example?.sentence) {
      this.ttsStore.play(example.sentence);
    }
  }

  onBackToDeck(): void {
    this.router.navigate(['/decks', this.deckId]);
  }

  onStudyAgain(): void {
    this.studyStore.startStudy(this.deckId, this.deckName());
  }
}
