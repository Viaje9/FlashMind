import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

type DecisionLayout = 'stacked' | 'inline';

@Component({
  selector: 'fm-study-decision-bar',
  templateUrl: './study-decision-bar.component.html',
  styleUrl: './study-decision-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmStudyDecisionBarComponent {
  readonly layout = input<DecisionLayout>('stacked');
  readonly unknownLabel = input('不知道');
  readonly knownLabel = input('知道');
  readonly disabled = input(false);

  readonly unknownClick = output<void>();
  readonly knownClick = output<void>();

  readonly iconSizeClass = computed(() => (this.layout() === 'inline' ? 'size-10' : 'size-14'));
  readonly labelClass = computed(() =>
    this.layout() === 'inline' ? 'text-xs font-bold uppercase hidden sm:block' : 'text-sm font-bold tracking-wider'
  );
  readonly unknownLabelClass = computed(() => `${this.labelClass()} text-error`);
  readonly knownLabelClass = computed(() => `${this.labelClass()} text-primary`);

  readonly unknownWrapperClass = computed(() =>
    this.layout() === 'inline'
      ? 'flex items-center gap-3 group'
      : 'flex flex-col items-center gap-2 group'
  );

  readonly knownWrapperClass = computed(() =>
    this.layout() === 'inline'
      ? 'flex items-center gap-3 group'
      : 'flex flex-col items-center gap-2 group'
  );

  readonly unknownButtonClass = computed(() => {
    const base = 'rounded-full border-2 border-error flex items-center justify-center';
    const size = this.iconSizeClass();
    const disabled = this.disabled() ? 'opacity-50 pointer-events-none' : '';
    return [base, size, disabled].filter(Boolean).join(' ');
  });

  readonly knownButtonClass = computed(() => {
    const base = 'rounded-full border-2 border-primary flex items-center justify-center';
    const size = this.iconSizeClass();
    const disabled = this.disabled() ? 'opacity-50 pointer-events-none' : '';
    return [base, size, disabled].filter(Boolean).join(' ');
  });
}
