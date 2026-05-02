import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CollectionsService } from '@flashmind/api-client';
import { of } from 'rxjs';
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
          provide: CollectionsService,
          useValue: {
            listCollectionItems: vi.fn().mockReturnValue(
              of({
                data: [
                  {
                    id: 'sentence-reservation',
                    kind: 'sentence',
                    text: 'I need to make a reservation.',
                    meaning: '我需要訂位。',
                    sourceWords: ['reservation'],
                    breakdownItems: [],
                    relatedChunks: [],
                    relatedSentences: [],
                    createdAt: '2026-05-02T00:00:00.000Z',
                    updatedAt: '2026-05-02T00:00:00.000Z',
                  },
                  {
                    id: 'collocation-reservation',
                    kind: 'collocation',
                    text: 'make a reservation',
                    meaning: '訂位',
                    sourceWords: ['reservation'],
                    breakdownItems: [],
                    relatedChunks: [],
                    relatedSentences: [],
                    createdAt: '2026-05-02T00:00:00.000Z',
                    updatedAt: '2026-05-02T00:00:00.000Z',
                  },
                ],
                meta: { hasMore: false, nextCursor: null },
              }),
            ),
          },
        },
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

  it('預設應顯示 API 回傳的全部收藏項目', async () => {
    await Promise.resolve();

    expect(component.activeFilter()).toBe('all');
    expect(component.visibleItems().length).toBe(component.store.items().length);
  });

  it('切換 tab 時應更新可見項目', async () => {
    await Promise.resolve();

    component.onFilterChange('sentence');

    expect(component.visibleItems().every((item) => item.kind === 'sentence')).toBe(true);
    expect(component.visibleItems().length).toBe(1);
  });

  it('搜尋時應以英文、中文或來源單字篩選', async () => {
    await Promise.resolve();

    component.searchTerm.set('訂位');

    expect(component.visibleItems().map((item) => item.id)).toEqual([
      'sentence-reservation',
      'collocation-reservation',
    ]);
  });
});
