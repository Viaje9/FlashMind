import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';
import { CollectionPackListComponent } from './collection-pack-list.component';

describe('CollectionPackListComponent', () => {
  let component: CollectionPackListComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CollectionPackStore,
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new CollectionPackListComponent());
  });

  it('預設應顯示全部收藏項目', () => {
    expect(component.activeFilter()).toBe('all');
    expect(component.visibleItems().length).toBe(component.store.items().length);
  });

  it('切換 tab 時應更新可見項目', () => {
    component.onFilterChange('sentence');

    expect(component.visibleItems().every((item) => item.kind === 'sentence')).toBe(true);
    expect(component.visibleItems().length).toBe(3);
  });

  it('搜尋時應以英文、中文或來源單字篩選', () => {
    component.searchTerm.set('訂位');

    expect(component.visibleItems().map((item) => item.id)).toEqual(['sentence-reservation']);
  });
});
