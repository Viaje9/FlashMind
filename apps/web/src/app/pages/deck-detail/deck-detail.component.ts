import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  DialogService,
  FmConfirmDialogComponent,
  FmEmptyStateComponent,
  FmFabComponent,
  FmIconButtonComponent,
  FmPageHeaderComponent,
  FmSearchInputComponent
} from '@flashmind/ui';
import { FmCardListItemComponent } from './components/card-list-item/card-list-item.component';
import { FmDeckStatsCardComponent } from './components/deck-stats-card/deck-stats-card.component';
import { DecksService, DeckDetail, DeckService, CardListItem, StudyService, StudySummary } from '@flashmind/api-client';
import { CardStore } from '../../components/card/card.store';
import {
  DailyOverrideDialogComponent,
  DailyOverrideDialogData,
  DailyOverrideDialogResult
} from './components/daily-override-dialog/daily-override-dialog.component';

@Component({
  selector: 'app-deck-detail-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmDeckStatsCardComponent,
    FmSearchInputComponent,
    FmCardListItemComponent,
    FmEmptyStateComponent,
    FmFabComponent,
    RouterLink,
    ReactiveFormsModule
  ],
  providers: [DialogService],
  templateUrl: './deck-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckDetailComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly decksService = inject(DecksService);
  private readonly deckService = inject(DeckService);
  private readonly studyService = inject(StudyService);
  private readonly cardStore = inject(CardStore);
  private readonly dialogService = inject(DialogService);

  readonly deckId = signal('');
  readonly searchControl = new FormControl('');
  readonly searchTerm = signal('');
  readonly deck = signal<DeckDetail | null>(null);
  readonly isLoading = signal(true);
  readonly studySummary = signal<StudySummary | null>(null);
  readonly overrideActive = signal(false);

  readonly cards = this.cardStore.cards;
  readonly cardsLoading = this.cardStore.loading;

  readonly filteredCards = computed(() => {
    const allCards = this.cards();
    const term = this.searchTerm().toLowerCase();
    if (!term) return allCards;
    return allCards.filter(
      (card) =>
        card.front.toLowerCase().includes(term) ||
        card.summary.toLowerCase().includes(term)
    );
  });

  readonly isEmpty = computed(() => !this.cardsLoading() && this.cards().length === 0);
  readonly hasStudyItems = computed(() => {
    const d = this.deck();
    return d ? d.stats.newCount > 0 || d.stats.reviewCount > 0 : false;
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.deckId.set(id);
      this.loadDeck(id);
      this.loadStudySummary(id);
      void this.cardStore.loadCards(id);
    }
    this.searchControl.valueChanges.subscribe((value) => {
      this.searchTerm.set(value ?? '');
    });
  }

  private loadDeck(id: string) {
    this.isLoading.set(true);
    this.decksService.getDeck(id).subscribe({
      next: (response) => {
        this.deck.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private loadStudySummary(deckId: string) {
    this.studyService.getStudySummary(deckId).subscribe({
      next: (response) => {
        this.studySummary.set(response.data);
        this.detectOverrideActive(response.data);
      },
      error: () => {
        // 靜默處理錯誤，進度條不顯示即可
      }
    });
  }

  private detectOverrideActive(summary: StudySummary): void {
    const d = this.deck();
    if (!d) return;
    // summary 回傳的是 effective limit，與牌組原始設定比較即可判斷覆寫狀態
    const isOverridden =
      summary.dailyNewCards > d.dailyNewCards ||
      summary.dailyReviewCards > d.dailyReviewCards;
    this.overrideActive.set(isOverridden);
  }

  onStartStudy() {
    const d = this.deck();
    if (!d) return;
    void this.router.navigate(['/decks', this.deckId(), 'study'], {
      queryParams: { name: d.name }
    });
  }

  onEditCard(cardId: string) {
    void this.router.navigate(['/decks', this.deckId(), 'cards', cardId, 'edit']);
  }

  onDeleteCard(card: CardListItem) {
    const dialogRef = this.dialogService.open(FmConfirmDialogComponent, {
      data: {
        title: '刪除卡片',
        message: `確定要刪除「${card.front}」嗎？此操作無法復原。`,
        confirmText: '刪除',
        cancelText: '取消'
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        const success = await this.cardStore.deleteCard(this.deckId(), card.id);
        if (success) {
          // 重新載入牌組資訊以更新統計
          this.loadDeck(this.deckId());
        }
      }
    });
  }

  onOverrideClick(): void {
    const summary = this.studySummary();
    if (!summary) return;

    const dialogRef = this.dialogService.open<
      DailyOverrideDialogComponent,
      DailyOverrideDialogData,
      DailyOverrideDialogResult
    >(DailyOverrideDialogComponent, {
      data: {
        dailyNewCards: summary.dailyNewCards,
        dailyReviewCards: summary.dailyReviewCards,
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.deckService.setDailyOverride(this.deckId(), {
          newCards: result.newCards,
          reviewCards: result.reviewCards,
        }).subscribe({
          next: () => {
            this.overrideActive.set(true);
            this.loadStudySummary(this.deckId());
          }
        });
      }
    });
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW');
  }

  formatLastStudied(dateStr: string | null | undefined): string {
    if (!dateStr) return '尚未學習';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-TW');
  }
}
