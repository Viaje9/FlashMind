import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'fm-number-input-row',
  templateUrl: './number-input-row.component.html',
  styleUrl: './number-input-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmNumberInputRowComponent {
  readonly label = input('');
  readonly title = input('');
  readonly description = input('');
  readonly icon = input('');
  readonly iconClass = input('bg-slate-500/10 text-slate-500');
  readonly value = input(0);
  readonly unit = input('張');
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly step = input<number | null>(null);
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  readonly valueChange = output<number>();

  readonly iconContainerClass = computed(() => {
    const base = 'flex items-center justify-center size-8 rounded-lg';
    return [base, this.iconClass()].filter(Boolean).join(' ');
  });

  readonly ariaLabelValue = computed(() => this.ariaLabel() || this.label() || this.title() || null);

  onInput(event: Event) {
    const inputElement = event.target as HTMLInputElement | null;
    if (!inputElement) {
      return;
    }
    const nextValue = Number(inputElement.value);
    this.valueChange.emit(Number.isNaN(nextValue) ? 0 : nextValue);
  }
}
