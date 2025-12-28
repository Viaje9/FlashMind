import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FmPageHeaderComponent } from '../../../../packages/ui/src/lib/molecules/page-header/page-header.component';
import { FmButtonComponent } from '../../../../packages/ui/src/lib/primitives/button/button.component';
import { FmIconButtonComponent } from '../../../../packages/ui/src/lib/primitives/icon-button/icon-button.component';
import { FmSearchInputComponent } from '../../../../packages/ui/src/lib/primitives/search-input/search-input.component';
import { FmDeckCardComponent } from '../../../../packages/ui/src/lib/organisms/deck-card/deck-card.component';

@Component({
  selector: 'app-root',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmIconButtonComponent,
    FmSearchInputComponent,
    FmDeckCardComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  readonly query = signal('');
  readonly lastAction = signal('');

  onSearch(value: string) {
    this.query.set(value);
  }

  onStartDeck(title: string) {
    this.lastAction.set(`開始「${title}」`);
  }
}
