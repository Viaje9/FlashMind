import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type HeaderLayout = 'start' | 'center';

@Component({
  selector: 'fm-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmPageHeaderComponent {
  readonly title = input('');
  readonly subtitle = input('');
  readonly layout = input<HeaderLayout>('start');
  readonly sticky = input(true);
  readonly dense = input(false);

  readonly containerClass = computed(() => {
    const base =
      'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm transition-colors duration-200';
    const spacing = this.dense() ? 'px-4 py-2' : 'px-4 py-3';
    const sticky = this.sticky() ? 'sticky top-0 z-30' : '';

    return [base, spacing, sticky].filter(Boolean).join(' ');
  });

  readonly titleClass = computed(() => {
    const base = 'flex flex-col';
    const align = this.layout() === 'center' ? 'items-center text-center' : 'items-start text-left';

    return [base, align].join(' ');
  });
}
