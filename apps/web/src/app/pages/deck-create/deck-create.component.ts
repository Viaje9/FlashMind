import { ChangeDetectionStrategy, Component } from '@angular/core';
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
    FmButtonComponent
  ],
  templateUrl: './deck-create.component.html',
  styleUrl: './deck-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeckCreateComponent {}
