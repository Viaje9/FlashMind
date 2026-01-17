import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type ProgressTone = 'primary' | 'success' | 'danger';

@Component({
  selector: 'fm-progress-bar',
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmProgressBarComponent {
  readonly value = input(0);
  readonly showLabel = input(false);
  readonly tone = input<ProgressTone>('primary');
  readonly testId = input<string>();

  readonly clampedValue = computed(() => {
    const raw = Number(this.value() ?? 0);
    if (Number.isNaN(raw)) {
      return 0;
    }
    return Math.min(100, Math.max(0, raw));
  });

  readonly barClass = computed(() => {
    if (this.tone() === 'success') {
      return 'bg-green-500';
    }
    if (this.tone() === 'danger') {
      return 'bg-red-500';
    }
    return 'bg-primary';
  });
}
