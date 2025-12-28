import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'fm-labeled-input',
  templateUrl: './labeled-input.component.html',
  styleUrl: './labeled-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmLabeledInputComponent {
  readonly label = input('');
  readonly placeholder = input('');
  readonly value = input('');
  readonly icon = input('');
  readonly type = input('text');
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  readonly valueChange = output<string>();

  readonly ariaLabelValue = computed(() => this.ariaLabel() || this.label() || null);

  onInput(event: Event) {
    const inputElement = event.target as HTMLInputElement | null;
    if (!inputElement) {
      return;
    }
    this.valueChange.emit(inputElement.value);
  }
}
