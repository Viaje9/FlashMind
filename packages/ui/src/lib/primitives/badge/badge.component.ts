import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type BadgeTone = 'info' | 'warning' | 'success' | 'neutral';

@Component({
  selector: 'fm-badge',
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmBadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly testId = input<string>();

  readonly classes = computed(() => {
    const base = 'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset';

    const tone =
      this.tone() === 'info'
        ? 'bg-blue-400/10 text-blue-500 ring-blue-500/20'
        : this.tone() === 'warning'
          ? 'bg-amber-400/10 text-amber-500 ring-amber-500/20'
          : this.tone() === 'success'
            ? 'bg-green-400/10 text-green-500 ring-green-500/20'
            : 'bg-slate-400/10 text-slate-500 ring-slate-500/20';

    return [base, tone].join(' ');
  });
}
