import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'fm-button',
  templateUrl: './button.component.html',
  styleUrl: './button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly fullWidth = input(false);
  readonly disabled = input(false);
  readonly type = input<ButtonType>('button');

  readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center gap-2 font-semibold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

    const variant =
      this.variant() === 'primary'
        ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25'
        : this.variant() === 'secondary'
          ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
          : this.variant() === 'danger'
            ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
            : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5';

    const size =
      this.size() === 'sm'
        ? 'px-3 py-2 text-sm rounded-lg'
        : this.size() === 'lg'
          ? 'px-6 py-4 text-base rounded-2xl'
          : 'px-4 py-3 text-base rounded-xl';

    const width = this.fullWidth() ? 'w-full' : '';
    const disabled = this.disabled() ? 'opacity-50 pointer-events-none' : '';

    return [base, variant, size, width, disabled].filter(Boolean).join(' ');
  });
}
