import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  FmEmptyStateComponent,
  FmIconButtonComponent,
  FmPageHeaderComponent,
  FmSearchInputComponent,
} from '@flashmind/ui';
import { CollectionFilterTabsComponent } from '../../components/collection-pack/collection-filter-tabs.component';
import { CollectionItemCardComponent } from '../../components/collection-pack/collection-item-card.component';
import {
  filterCollectionItems,
  type CollectionFilter,
} from '../../components/collection-pack/collection-pack.domain';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';

@Component({
  selector: 'app-collection-pack-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    FmEmptyStateComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    FmSearchInputComponent,
    CollectionFilterTabsComponent,
    CollectionItemCardComponent,
  ],
  templateUrl: './collection-pack-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPackListComponent {
  private readonly router = inject(Router);
  readonly store = inject(CollectionPackStore);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = signal('');
  readonly activeFilter = signal<CollectionFilter>('all');

  readonly visibleItems = computed(() =>
    filterCollectionItems(this.store.items(), this.activeFilter(), this.searchTerm()),
  );

  constructor() {
    void this.store.loadItems();
    this.searchControl.valueChanges.subscribe((value) => {
      this.searchTerm.set(value);
      void this.store.loadItems(this.activeFilter(), value);
    });
  }

  onFilterChange(filter: CollectionFilter): void {
    this.activeFilter.set(filter);
    void this.store.loadItems(filter, this.searchTerm());
  }

  onHeaderTitleClick(): void {
    void this.router.navigate(['/home']);
  }
}
