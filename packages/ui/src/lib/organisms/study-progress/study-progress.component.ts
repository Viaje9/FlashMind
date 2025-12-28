import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FmProgressBarComponent } from '../../primitives/progress-bar/progress-bar.component';

@Component({
  selector: 'fm-study-progress',
  imports: [FmProgressBarComponent],
  templateUrl: './study-progress.component.html',
  styleUrl: './study-progress.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmStudyProgressComponent {
  readonly label = input('進度');
  readonly current = input(0);
  readonly total = input(0);
  readonly value = input<number | null>(null);
  readonly tone = input<'primary' | 'success' | 'danger'>('primary');

  readonly progressLabel = computed(() => `${this.current()} / ${this.total()}`);

  readonly progressValue = computed(() => {
    const explicitValue = this.value();
    if (explicitValue !== null) {
      return explicitValue;
    }
    const total = this.total();
    if (total <= 0) {
      return 0;
    }
    return Math.round((this.current() / total) * 100);
  });
}
