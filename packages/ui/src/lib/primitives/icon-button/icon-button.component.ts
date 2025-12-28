import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type IconButtonVariant = 'neutral' | 'primary' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';
type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'fm-icon-button',
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmIconButtonComponent {
  readonly variant = input<IconButtonVariant>('neutral');
  readonly size = input<IconButtonSize>('md');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  readonly ariaLabelValue = computed(() => this.ariaLabel() || null);

  readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

    const variant =
      this.variant() === 'primary'
        ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
        : this.variant() === 'danger'
          ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
          : this.variant() === 'ghost'
            ? 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            : 'text-slate-600 dark:text-white hover:bg-black/5 dark:hover:bg-white/10';

    const size =
      this.size() === 'sm'
        ? 'size-8'
        : this.size() === 'lg'
          ? 'size-12'
          : 'size-10';

    const disabled = this.disabled() ? 'opacity-50 pointer-events-none' : '';

    return [base, variant, size, disabled].filter(Boolean).join(' ');
  });
}
