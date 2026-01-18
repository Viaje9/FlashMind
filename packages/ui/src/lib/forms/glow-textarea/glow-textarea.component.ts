import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ValidationError } from '../labeled-input/labeled-input.component';

@Component({
  selector: 'fm-glow-textarea',
  templateUrl: './glow-textarea.component.html',
  styleUrl: './glow-textarea.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FmGlowTextareaComponent),
      multi: true
    }
  ]
})
export class FmGlowTextareaComponent implements ControlValueAccessor {
  readonly placeholder = input('');
  readonly minHeightClass = input('min-h-[140px]');
  readonly maxLength = input<number | null | undefined>(null);
  readonly showCount = input(true);
  readonly ariaLabel = input('');
  readonly testId = input<string>();

  // Signal Forms support: use model() for two-way binding
  readonly value = model('');
  readonly disabled = input(false);
  readonly touched = model(false);

  // Signal Forms auto-binds errors to this input
  readonly errors = input<readonly ValidationError[]>([]);

  readonly textAreaClass = computed(() => {
    const base =
      'w-full bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 p-4 text-lg font-normal leading-relaxed resize-none rounded-lg';
    return [base, this.minHeightClass()].filter(Boolean).join(' ');
  });

  readonly countLabel = computed(() => {
    if (!this.showCount()) {
      return '';
    }
    const maxLength = this.maxLength();
    if (!maxLength) {
      return '';
    }
    return `${this.value().length}/${maxLength}`;
  });

  readonly ariaLabelValue = computed(() => this.ariaLabel() || this.placeholder() || '輸入內容');

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
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    this.value.set(target.value);
    this.onChange(target.value);
  }

  onBlur(): void {
    this.touched.set(true);
    this.onTouched();
  }
}
