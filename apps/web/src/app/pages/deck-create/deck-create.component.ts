import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FmButtonComponent,
  FmIconButtonComponent,
  FmLabeledInputComponent,
  FmNumberInputRowComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent
} from '../../../../../../packages/ui/src/index';
import { DecksService } from '@flashmind/api-client';

@Component({
  selector: 'app-deck-create-page',
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
  templateUrl: './deck-create.component.html',
  styleUrl: './deck-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckCreateComponent {
  private readonly router = inject(Router);
  private readonly decksService = inject(DecksService);

  readonly deckNameControl = new FormControl('', [Validators.required, Validators.maxLength(100)]);
  readonly dailyNewCardsControl = new FormControl(20);
  readonly dailyReviewCardsControl = new FormControl(100);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  get isFormValid(): boolean {
    return this.deckNameControl.valid && !!this.deckNameControl.value?.trim();
  }

  onSave() {
    if (!this.isFormValid) {
      this.errorMessage.set('請輸入牌組名稱');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.decksService.createDeck({
      name: this.deckNameControl.value!.trim(),
      dailyNewCards: this.dailyNewCardsControl.value ?? 20,
      dailyReviewCards: this.dailyReviewCardsControl.value ?? 100
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/decks', response.data.id]);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('建立牌組失敗，請稍後再試');
      }
    });
  }

  onCancel() {
    void this.router.navigate(['/decks']);
  }
}
