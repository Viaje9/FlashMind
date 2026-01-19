import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FmButtonComponent,
  FmIconButtonComponent,
  FmPageHeaderComponent,
} from '@flashmind/ui';
import { CardsService, CreateCardRequest, ImportCardsResult } from '@flashmind/api-client';
import {
  parseImportJson,
  getValidCards,
  getInvalidCards,
  ParsedCard,
} from './card-import.domain';

type ImportStep = 'input' | 'preview' | 'result';

@Component({
  selector: 'app-card-import-page',
  imports: [FmPageHeaderComponent, FmIconButtonComponent, FmButtonComponent, RouterLink],
  templateUrl: './card-import.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardImportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cardsService = inject(CardsService);

  readonly deckId = signal('');
  readonly jsonInput = signal('');
  readonly parseError = signal('');
  readonly parsedCards = signal<ParsedCard[]>([]);
  readonly isImporting = signal(false);
  readonly importResult = signal<ImportCardsResult | null>(null);
  readonly currentStep = signal<ImportStep>('input');

  readonly validCards = computed(() => getValidCards(this.parsedCards()));
  readonly invalidCards = computed(() => getInvalidCards(this.parsedCards()));
  readonly canImport = computed(
    () => this.validCards().length > 0 && !this.parseError() && !this.isImporting()
  );

  readonly exampleJson = JSON.stringify(
    {
      cards: [
        {
          front: 'hello',
          meanings: [
            {
              zhMeaning: '你好',
              enExample: 'Hello, how are you?',
              zhExample: '你好，你好嗎？',
            },
          ],
        },
        {
          front: 'world',
          meanings: [{ zhMeaning: '世界' }],
        },
      ],
    },
    null,
    2
  );

  ngOnInit() {
    const deckId = this.route.snapshot.paramMap.get('deckId');
    if (deckId) {
      this.deckId.set(deckId);
    }
  }

  onJsonInputChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.jsonInput.set(textarea.value);
    this.parseJson(textarea.value);
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        this.jsonInput.set(content);
        this.parseJson(content);
      };
      reader.readAsText(file);
    }
  }

  private parseJson(jsonString: string) {
    const result = parseImportJson(jsonString);

    if (result.error) {
      this.parseError.set(result.error);
      this.parsedCards.set([]);
      return;
    }

    this.parseError.set('');
    this.parsedCards.set(result.cards);
    if (result.cards.length > 0) {
      this.currentStep.set('preview');
    }
  }

  onConfirmImport() {
    if (!this.canImport()) return;

    this.isImporting.set(true);

    const cardsToImport: CreateCardRequest[] = this.validCards().map((card) => ({
      front: card.front,
      meanings: card.meanings.map((m) => ({
        zhMeaning: m.zhMeaning,
        enExample: m.enExample,
        zhExample: m.zhExample,
      })),
    }));

    this.cardsService
      .importCards(this.deckId(), { cards: cardsToImport })
      .subscribe({
        next: (response) => {
          this.importResult.set(response.data);
          this.currentStep.set('result');
          this.isImporting.set(false);
        },
        error: () => {
          this.isImporting.set(false);
        },
      });
  }

  onBackToInput() {
    this.currentStep.set('input');
    this.parsedCards.set([]);
    this.parseError.set('');
  }

  onBackToDeck() {
    void this.router.navigate(['/decks', this.deckId()]);
  }

  copyExample() {
    navigator.clipboard.writeText(this.exampleJson);
  }
}
