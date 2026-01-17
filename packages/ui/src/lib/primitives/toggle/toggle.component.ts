import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'fm-toggle',
  templateUrl: './toggle.component.html',
  styleUrl: './toggle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FmToggleComponent),
      multi: true
    }
  ]
})
export class FmToggleComponent implements ControlValueAccessor {
  readonly ariaLabel = input('');

  // Signal Forms support: use model() for two-way binding
  readonly checked = model(false);
  readonly disabled = input(false);

  readonly ariaLabelValue = computed(() => this.ariaLabel() || null);

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  // ControlValueAccessor implementation for traditional Reactive Forms
  writeValue(value: boolean): void {
    this.checked.set(value ?? false);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Note: disabled is now an input for Signal Forms compatibility
  }

  onToggle(event: Event): void {
    const inputElement = event.target as HTMLInputElement | null;
    if (!inputElement) {
      return;
    }
    this.checked.set(inputElement.checked);
    this.onChange(inputElement.checked);
    this.onTouched();
  }
}
