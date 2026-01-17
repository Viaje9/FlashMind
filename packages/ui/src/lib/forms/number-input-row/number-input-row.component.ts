import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'fm-number-input-row',
  templateUrl: './number-input-row.component.html',
  styleUrl: './number-input-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FmNumberInputRowComponent),
      multi: true
    }
  ]
})
export class FmNumberInputRowComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly title = input('');
  readonly description = input('');
  readonly icon = input('');
  readonly iconClass = input('bg-slate-500/10 text-slate-500');
  readonly unit = input('張');
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly step = input<number | null>(null);
  readonly ariaLabel = input('');
  readonly testId = input<string>();

  readonly value = signal(0);
  readonly disabled = signal(false);

  readonly iconContainerClass = computed(() => {
    const base = 'flex items-center justify-center size-8 rounded-lg';
    return [base, this.iconClass()].filter(Boolean).join(' ');
  });

  readonly ariaLabelValue = computed(() => this.ariaLabel() || this.label() || this.title() || null);

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number): void {
    this.value.set(value ?? 0);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement | null;
    if (!inputElement) {
      return;
    }
    const nextValue = Number(inputElement.value);
    const finalValue = Number.isNaN(nextValue) ? 0 : nextValue;
    this.value.set(finalValue);
    this.onChange(finalValue);
  }

  onBlur(): void {
    this.onTouched();
  }
}
