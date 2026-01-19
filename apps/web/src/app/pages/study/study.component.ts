import { ChangeDetectionStrategy, Component, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { FmStudyCardComponent, StudyExample } from './components/study-card/study-card.component';
import { FmStudyDecisionBarComponent } from './components/study-decision-bar/study-decision-bar.component';
import { FmStudyProgressComponent } from './components/study-progress/study-progress.component';
import { FmSwipeableCardComponent } from './components/swipeable-card/swipeable-card.component';
import { StudyStore } from '../../components/study/study.store';
import { TtsStore } from '../../components/tts/tts.store';
import { mapMeaningsToExamples, getTranslations, StudyRating } from '../../components/study/study.domain';

@Component({
  selector: 'app-study-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmStudyProgressComponent,
    FmStudyCardComponent,
    FmStudyDecisionBarComponent,
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
  readonly stats = this.studyStore.stats;
  readonly deckName = this.studyStore.deckName;

  readonly word = computed(() => this.currentCard()?.front ?? '');
  readonly translations = computed(() => {
    const card = this.currentCard();
    return card ? getTranslations(card) : [];
  });
  readonly examples = computed((): StudyExample[] => {
    const card = this.currentCard();
    return card ? mapMeaningsToExamples(card) : [];
  });

  readonly isLoading = computed(() => this.phase() === 'loading');
  readonly isStudying = computed(() => this.phase() === 'studying');
  readonly isCompleted = computed(() => this.phase() === 'completed');
  readonly hasError = computed(() => this.phase() === 'error');
  readonly showDecisionBar = computed(() => this.isStudying() && this.isFlipped());

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
    if (!this.isFlipped()) {
      this.studyStore.flipCard();
    }
  }

  onSwipeStart(): void {
    // 拖拽開始時自動翻牌
    if (!this.isFlipped()) {
      this.studyStore.flipCard();
    }
  }

  onSwipeComplete(rating: StudyRating): void {
    this.studyStore.submitRating(rating);
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
