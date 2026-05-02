import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { COLLECTION_FILTERS, type CollectionFilter } from './collection-pack.domain';

@Component({
  selector: 'app-collection-filter-tabs',
  template: `
    <div
      class="grid grid-cols-5 gap-1 rounded-2xl border border-slate-700 bg-background-dark/80 p-1"
      role="tablist"
      aria-label="收藏類型"
    >
      @for (filter of filters; track filter.value) {
        <button
          type="button"
          [class]="buttonClass(filter.value)"
          role="tab"
          [attr.aria-selected]="activeFilter() === filter.value"
          [attr.data-testid]="'collection-filter-' + filter.value"
          (click)="filterChange.emit(filter.value)"
        >
          {{ filter.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionFilterTabsComponent {
  readonly activeFilter = input.required<CollectionFilter>();
  readonly filterChange = output<CollectionFilter>();
  readonly filters = COLLECTION_FILTERS;

  buttonClass(filter: CollectionFilter): string {
    const base = 'min-h-10 rounded-xl px-2 text-xs font-bold transition';
    const active = 'bg-primary text-background-dark shadow-lg shadow-primary/20';
    const inactive = 'text-secondary-text hover:bg-white/5';

    return [base, this.activeFilter() === filter ? active : inactive].join(' ');
  }
}
