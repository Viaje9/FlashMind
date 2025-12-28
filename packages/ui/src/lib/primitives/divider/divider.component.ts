import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'fm-divider',
  templateUrl: './divider.component.html',
  styleUrl: './divider.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmDividerComponent {
  readonly label = input('分隔');
  readonly uppercase = input(true);

  readonly labelClass = computed(() => {
    const base = 'flex-shrink-0 mx-4 text-slate-400';
    const casing = this.uppercase() ? 'text-xs uppercase tracking-wider' : 'text-xs';
    return [base, casing].join(' ');
  });
}
