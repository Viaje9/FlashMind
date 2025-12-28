import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'fm-glow-textarea',
  templateUrl: './glow-textarea.component.html',
  styleUrl: './glow-textarea.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmGlowTextareaComponent {
  readonly value = input('');
  readonly placeholder = input('');
  readonly minHeightClass = input('min-h-[140px]');
  readonly maxLength = input<number | null>(null);
  readonly showCount = input(true);
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  readonly valueChange = output<string>();

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

  onInput(event: Event) {
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    this.valueChange.emit(target.value);
  }
}
