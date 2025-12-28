import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type FabSize = 'md' | 'lg';

type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'fm-fab',
  templateUrl: './fab.component.html',
  styleUrl: './fab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmFabComponent {
  readonly size = input<FabSize>('lg');
  readonly type = input<ButtonType>('button');
  readonly ariaLabel = input('');
  readonly disabled = input(false);

  readonly ariaLabelValue = computed(() => this.ariaLabel() || null);

  readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
    const size = this.size() === 'md' ? 'h-12 w-12' : 'h-14 w-14';
    const disabled = this.disabled() ? 'opacity-50 pointer-events-none' : '';

    return [base, size, disabled].filter(Boolean).join(' ');
  });
}
