import '@angular/compiler';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import {
  type CardListItem,
  DeckService,
  type DeckDetail,
  DecksService,
  StudyService,
  type StudySummary,
} from '@flashmind/api-client';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardStore } from '../../components/card/card.store';
import { DECK_DETAIL_CARD_FILTER } from './deck-detail-filter.domain';
import { DeckDetailComponent } from './deck-detail.component';

describe('DeckDetailComponent filters', () => {
  let fixture: ComponentFixture<DeckDetailComponent>;
  let component: DeckDetailComponent;
  let cardStoreMock: ReturnType<typeof createCardStoreMock>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    cardStoreMock = createCardStoreMock();

    await TestBed.configureTestingModule({
      imports: [DeckDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'deck-1' }),
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: DecksService,
          useValue: {
            getDeck: vi.fn(() => of({ data: createDeckDetail() })),
          },
        },
        {
          provide: StudyService,
          useValue: {
            getStudySummary: vi.fn(() => of({ data: createStudySummary() })),
          },
        },
        {
          provide: DeckService,
          useValue: {
            setDailyOverride: vi.fn(() => of({})),
          },
        },
        {
          provide: CardStore,
          useValue: cardStoreMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeckDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('預設應顯示所有卡片', () => {
    expect(component.selectedFilter()).toBe(DECK_DETAIL_CARD_FILTER.ALL);
    expect(component.sortDirection()).toBe('asc');
    expect(getRenderedCardIds(fixture)).toEqual([
      'due-8',
      'due-3',
      'overdue',
      'due-2',
      'due-7',
      'new-card',
    ]);
  });

  it('選擇七天內到期應僅顯示 7 天內非 NEW 卡片', () => {
    setFilter(fixture, DECK_DETAIL_CARD_FILTER.DUE_IN_7_DAYS);

    expect(getRenderedCardIds(fixture)).toEqual(['due-3', 'due-2', 'due-7']);
  });

  it('選擇三天內到期與新卡片應套用對應篩選', () => {
    setFilter(fixture, DECK_DETAIL_CARD_FILTER.DUE_IN_3_DAYS);
    expect(getRenderedCardIds(fixture)).toEqual(['due-3', 'due-2']);

    setFilter(fixture, DECK_DETAIL_CARD_FILTER.NEW);
    expect(getRenderedCardIds(fixture)).toEqual(['new-card']);
  });

  it('搜尋與篩選應同時生效（交集）', () => {
    setFilter(fixture, DECK_DETAIL_CARD_FILTER.DUE_IN_7_DAYS);
    setSearch(fixture, 'target');

    expect(getRenderedCardIds(fixture)).toEqual(['due-2']);
  });

  it('點擊排序按鈕後應切換為降冪排序', () => {
    toggleSort(fixture);

    expect(component.sortDirection()).toBe('desc');
    expect(getRenderedCardIds(fixture)).toEqual([
      'new-card',
      'due-7',
      'due-2',
      'overdue',
      'due-3',
      'due-8',
    ]);
  });
});

function createCardStoreMock() {
  return {
    cards: signal<CardListItem[]>([
      {
        id: 'new-card',
        front: 'Target New Card',
        summary: '尚未練習',
        state: 'NEW',
        due: null,
      },
      {
        id: 'due-2',
        front: 'Review Soon',
        summary: 'target due in two days',
        state: 'REVIEW',
        due: '2026-03-03T00:00:00.000Z',
      },
      {
        id: 'due-3',
        front: 'Learning Card',
        summary: 'due in three days',
        state: 'LEARNING',
        due: '2026-03-04T00:00:00.000Z',
      },
      {
        id: 'due-7',
        front: 'Seven Day Card',
        summary: 'review card',
        state: 'REVIEW',
        due: '2026-03-08T00:00:00.000Z',
      },
      {
        id: 'due-8',
        front: 'Later Card',
        summary: 'outside seven days',
        state: 'REVIEW',
        due: '2026-03-09T00:00:00.000Z',
      },
      {
        id: 'overdue',
        front: 'Overdue Card',
        summary: 'already overdue',
        state: 'REVIEW',
        due: '2026-02-28T00:00:00.000Z',
      },
    ]),
    loading: signal(false),
    loadCards: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(true),
  };
}

function createDeckDetail(): DeckDetail {
  return {
    id: 'deck-1',
    name: '測試牌組',
    dailyNewCards: 20,
    dailyReviewCards: 100,
    dailyResetHour: 4,
    enableReverse: false,
    stats: {
      newCount: 1,
      reviewCount: 5,
      totalCount: 6,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastStudiedAt: null,
    },
  };
}

function createStudySummary(): StudySummary {
  return {
    totalCards: 6,
    newCount: 1,
    reviewCount: 5,
    todayStudied: 0,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    todayNewStudied: 0,
    todayReviewStudied: 0,
  };
}

function setFilter(fixture: ComponentFixture<DeckDetailComponent>, value: string): void {
  const root = fixture.nativeElement as HTMLElement;
  const trigger = root.querySelector(
    '[data-testid="deck-detail-filter-trigger"]',
  ) as HTMLButtonElement | null;
  if (!trigger) {
    throw new Error('deck-detail-filter-trigger not found');
  }

  trigger.click();
  fixture.detectChanges();

  const option = document.querySelector(
    `[data-testid="deck-detail-filter-option-${value}"]`,
  ) as HTMLButtonElement | null;
  if (!option) {
    throw new Error(`deck-detail-filter-option-${value} not found`);
  }

  option.click();
  fixture.detectChanges();
}

function setSearch(fixture: ComponentFixture<DeckDetailComponent>, value: string): void {
  const input = fixture.nativeElement.querySelector(
    '[data-testid="deck-detail-search"]',
  ) as HTMLInputElement | null;
  if (!input) {
    throw new Error('deck-detail-search not found');
  }

  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function toggleSort(fixture: ComponentFixture<DeckDetailComponent>): void {
  const root = fixture.nativeElement as HTMLElement;
  const button = root.querySelector(
    '[data-testid="deck-detail-sort-toggle"]',
  ) as HTMLButtonElement | null;
  if (!button) {
    throw new Error('deck-detail-sort-toggle not found');
  }

  button.click();
  fixture.detectChanges();
}

function getRenderedCardIds(fixture: ComponentFixture<DeckDetailComponent>): string[] {
  const root = fixture.nativeElement as HTMLElement;
  const cards = root.querySelectorAll('[data-testid^="deck-detail-card-"]');
  return Array.from(cards)
    .map((element) => (element as HTMLElement).getAttribute('data-testid') ?? '')
    .map((testId) => testId.replace('deck-detail-card-', ''))
    .filter((id) => id.length > 0);
}
