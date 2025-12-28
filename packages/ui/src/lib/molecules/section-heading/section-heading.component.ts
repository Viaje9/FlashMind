import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'fm-section-heading',
  templateUrl: './section-heading.component.html',
  styleUrl: './section-heading.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmSectionHeadingComponent {
  readonly text = input('');
  readonly padded = input(true);

  readonly classes = computed(() => {
    const base = 'text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider';
    const padding = this.padded() ? 'px-4 pb-2' : 'pb-2';
    return [base, padding].join(' ');
  });
}
