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
  readonly maxLength = input<number | null>(null);
  readonly showCount = input(true);
  readonly ariaLabel = input('');
  readonly testId = input<string>();

  readonly value = signal('');
  readonly disabled = signal(false);

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

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

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
    this.disabled.set(isDisabled);
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
    this.onTouched();
  }
}
