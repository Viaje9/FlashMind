import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FmButtonComponent,
  FmIconButtonComponent,
  FmLabeledInputComponent,
  FmNumberInputRowComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent,
  FmConfirmDialogComponent,
  DialogService
} from '@flashmind/ui';
import { DecksService } from '@flashmind/api-client';

@Component({
  selector: 'app-deck-settings-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmLabeledInputComponent,
    FmSectionHeadingComponent,
    FmNumberInputRowComponent,
    FmButtonComponent,
    RouterLink,
    ReactiveFormsModule
  ],
  templateUrl: './deck-settings.component.html',
  styleUrl: './deck-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckSettingsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly decksService = inject(DecksService);
  private readonly dialogService = inject(DialogService);

  readonly deckNameControl = new FormControl('', [Validators.required, Validators.maxLength(100)]);
  readonly dailyNewCardsControl = new FormControl(20);
  readonly dailyReviewCardsControl = new FormControl(100);

  readonly deckId = signal('');
  readonly deckName = signal('');
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly isDeleting = signal(false);
  readonly errorMessage = signal('');

  get isFormValid(): boolean {
    return this.deckNameControl.valid && !!this.deckNameControl.value?.trim();
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.deckId.set(id);
      this.loadDeck(id);
    }
  }

  private loadDeck(id: string) {
    this.isLoading.set(true);
    this.decksService.getDeck(id).subscribe({
      next: (response) => {
        const deck = response.data;
        this.deckName.set(deck.name);
        this.deckNameControl.setValue(deck.name);
        this.dailyNewCardsControl.setValue(deck.dailyNewCards);
        this.dailyReviewCardsControl.setValue(deck.dailyReviewCards);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('載入牌組失敗');
      }
    });
  }

  onSave() {
    if (!this.isFormValid) {
      this.errorMessage.set('請輸入牌組名稱');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.decksService.updateDeck(this.deckId(), {
      name: this.deckNameControl.value!.trim(),
      dailyNewCards: this.dailyNewCardsControl.value ?? 20,
      dailyReviewCards: this.dailyReviewCardsControl.value ?? 100
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/decks', this.deckId()]);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('更新牌組失敗，請稍後再試');
      }
    });
  }

  onDelete() {
    const dialogRef = this.dialogService.open(FmConfirmDialogComponent, {
      data: {
        title: '刪除牌組',
        message: `確定要刪除「${this.deckName()}」嗎？此操作將刪除所有卡片與學習紀錄，且無法復原。`,
        confirmLabel: '確認刪除',
        cancelLabel: '取消'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.performDelete();
      }
    });
  }

  private performDelete() {
    this.isDeleting.set(true);
    this.decksService.deleteDeck(this.deckId()).subscribe({
      next: () => {
        this.isDeleting.set(false);
        void this.router.navigate(['/decks']);
      },
      error: () => {
        this.isDeleting.set(false);
        this.errorMessage.set('刪除牌組失敗，請稍後再試');
      }
    });
  }

  onCancel() {
    void this.router.navigate(['/decks', this.deckId()]);
  }
}
