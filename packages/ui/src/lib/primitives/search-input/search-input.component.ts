import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'fm-search-input',
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmSearchInputComponent {
  readonly value = input('');
  readonly placeholder = input('搜尋...');
  readonly disabled = input(false);
  readonly ariaLabel = input('搜尋');
  readonly changed = output<string>();

  onInput(event: Event) {
    const inputElement = event.target as HTMLInputElement | null;
    if (!inputElement) {
      return;
    }
    this.changed.emit(inputElement.value);
  }
}
