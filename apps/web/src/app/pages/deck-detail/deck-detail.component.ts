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
import { DecksService, DeckDetail, CardListItem } from '@flashmind/api-client';
import { CardStore } from '../../components/card/card.store';

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
  private readonly cardStore = inject(CardStore);
  private readonly dialogService = inject(DialogService);

  readonly deckId = signal('');
  readonly searchControl = new FormControl('');
  readonly searchTerm = signal('');
  readonly deck = signal<DeckDetail | null>(null);
  readonly isLoading = signal(true);

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
