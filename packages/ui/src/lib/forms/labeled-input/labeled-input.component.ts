import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface ValidationError {
  kind: string;
  message?: string;
}

@Component({
  selector: 'fm-labeled-input',
  templateUrl: './labeled-input.component.html',
  styleUrl: './labeled-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FmLabeledInputComponent),
      multi: true
    }
  ]
})
export class FmLabeledInputComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('');
  readonly icon = input('');
  readonly type = input('text');
  readonly ariaLabel = input('');
  readonly testId = input<string>();

  // Signal Forms support: use model() for two-way binding
  readonly value = model('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = model(false);

  // Signal Forms auto-binds errors to this input
  readonly errors = input<readonly ValidationError[]>([]);

  readonly ariaLabelValue = computed(() => this.ariaLabel() || this.label() || null);

  // Show error when touched and has errors
  readonly showError = computed(() => this.touched() && this.errors().length > 0);
  readonly firstErrorMessage = computed(() => this.errors()[0]?.message ?? '');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ControlValueAccessor implementation for traditional Reactive Forms
  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Note: disabled is now an input for Signal Forms compatibility
  }

  onInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement | null;
    if (!inputElement) {
      return;
    }
    this.value.set(inputElement.value);
    this.onChange(inputElement.value);
  }

  onBlur(): void {
    this.touched.set(true);
    this.onTouched();
  }
}
