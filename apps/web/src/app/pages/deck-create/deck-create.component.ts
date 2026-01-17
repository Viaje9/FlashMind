import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  FmButtonComponent,
  FmIconButtonComponent,
  FmLabeledInputComponent,
  FmNumberInputRowComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent
} from '../../../../../../packages/ui/src/index';

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
  readonly deckNameControl = new FormControl('');
  readonly dailyNewCardsControl = new FormControl(20);
  readonly dailyReviewCardsControl = new FormControl(100);
}
