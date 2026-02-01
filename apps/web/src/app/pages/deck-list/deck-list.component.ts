import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FmEmptyStateComponent, FmFabComponent, FmIconButtonComponent, FmPageHeaderComponent, FmSearchInputComponent } from '@flashmind/ui';
import { FmDeckCardComponent } from '../../components/deck/deck-card/deck-card.component';
import { DecksService, DeckListItem } from '@flashmind/api-client';

interface DeckPreview {
  id: string;
  title: string;
  newCount: number;
  reviewCount: number;
  progress: number;
  completed: boolean;
  showAction: boolean;
  actionLabel: string;
  enableReverse: boolean;
}

@Component({
  selector: 'app-deck-list-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmSearchInputComponent,
    FmDeckCardComponent,
    FmEmptyStateComponent,
    FmFabComponent,
    RouterLink,
    ReactiveFormsModule
  ],
  templateUrl: './deck-list.component.html',
  styleUrl: './deck-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly decksService = inject(DecksService);

  readonly searchControl = new FormControl('');
  readonly searchTerm = signal('');
  readonly deckItems = signal<DeckListItem[]>([]);
  readonly isLoading = signal(true);

  readonly decks = computed<DeckPreview[]>(() => {
    const items = this.deckItems();
    const term = this.searchTerm().toLowerCase();

    return items
      .filter(deck => !term || deck.name.toLowerCase().includes(term))
      .map(deck => this.mapToDeckPreview(deck));
  });

  readonly isEmpty = computed(() => !this.isLoading() && this.deckItems().length === 0);
  readonly showEmptyState = computed(() => this.isEmpty() || this.decks().length === 0);

  ngOnInit() {
    this.loadDecks();
    this.searchControl.valueChanges.subscribe(value => {
      this.searchTerm.set(value ?? '');
    });
  }

  private loadDecks() {
    this.isLoading.set(true);
    this.decksService.listDecks().subscribe({
      next: (response) => {
        this.deckItems.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private mapToDeckPreview(deck: DeckListItem): DeckPreview {
    const hasStudyItems = deck.newCount > 0 || deck.reviewCount > 0;
    const completed = deck.progress >= 100;

    return {
      id: deck.id,
      title: deck.name,
      newCount: deck.newCount,
      reviewCount: deck.reviewCount,
      progress: deck.progress,
      completed,
      showAction: hasStudyItems,
      actionLabel: hasStudyItems ? '開始學習' : (completed ? '已完成' : '無待學習'),
      enableReverse: deck.enableReverse ?? false
    };
  }

  onDeckAction(deckId: string) {
    void this.router.navigate(['/decks', deckId]);
  }
}
