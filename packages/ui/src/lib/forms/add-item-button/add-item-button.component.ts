import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'fm-add-item-button',
  templateUrl: './add-item-button.component.html',
  styleUrl: './add-item-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmAddItemButtonComponent {
  readonly label = input('新增');
  readonly icon = input('add_circle');
  readonly disabled = input(false);

  readonly clicked = output<void>();

  readonly buttonClass = computed(() => {
    const base =
      'flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all group';
    const disabled = this.disabled() ? 'opacity-50 pointer-events-none' : '';
    return [base, disabled].filter(Boolean).join(' ');
  });
}
