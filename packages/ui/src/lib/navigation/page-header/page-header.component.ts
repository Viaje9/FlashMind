import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type HeaderLayout = 'start' | 'center';

@Component({
  selector: 'fm-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.sticky]': 'sticky()',
    '[class.top-0]': 'sticky()',
    '[class.z-30]': 'sticky()',
  },
})
export class FmPageHeaderComponent {
  readonly title = input('');
  readonly subtitle = input('');
  readonly layout = input<HeaderLayout>('start');
  readonly sticky = input(true);
  readonly dense = input(false);
  readonly testId = input<string>();

  readonly containerClass = computed(() => {
    const base =
      'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm transition-colors duration-200';
    const spacing = this.dense()
      ? 'px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]'
      : 'px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]';
    return [base, spacing].join(' ');
  });

  readonly titleClass = computed(() => {
    const base = 'flex flex-col';
    const align = this.layout() === 'center' ? 'items-center text-center' : 'items-start text-left';

    return [base, align].join(' ');
  });
}
