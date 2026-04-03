import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { DialogService } from '@flashmind/ui';
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
import {
  DECK_DETAIL_CARD_DIRECTION_FILTER,
  DECK_DETAIL_CARD_FILTER,
} from './deck-detail-filter.domain';
import { DeckDetailComponent } from './deck-detail.component';

describe('DeckDetailComponent filters', () => {
  let component: DeckDetailComponent;
  let cardStoreMock: ReturnType<typeof createCardStoreMock>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    cardStoreMock = createCardStoreMock();

    TestBed.configureTestingModule({
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
        {
          provide: DialogService,
          useValue: {
            open: vi.fn(),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new DeckDetailComponent());
    component.ngOnInit();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('預設應顯示所有卡片，且方向篩選預設為全部卡面', () => {
    expect(component.selectedFilter()).toBe(DECK_DETAIL_CARD_FILTER.ALL);
    expect(component.selectedDirectionFilter()).toBe(DECK_DETAIL_CARD_DIRECTION_FILTER.ALL);
    expect(component.filteredCards().map((card) => card.id)).toEqual([
      'overdue',
      'due-6h',
      'due-12h',
      'due-1d',
      'due-2',
      'due-3',
      'new-card',
      'new-card-reverse',
    ]);
  });

  it('選擇既有到期篩選時應維持原本過濾行為', () => {
    component.selectFilterOption(DECK_DETAIL_CARD_FILTER.DUE_IN_12_HOURS);
    expect(component.filteredCards().map((card) => card.id)).toEqual(['due-6h', 'due-12h']);

    component.selectFilterOption(DECK_DETAIL_CARD_FILTER.DUE_IN_1_DAY);
    expect(component.filteredCards().map((card) => card.id)).toEqual([
      'due-6h',
      'due-12h',
      'due-1d',
    ]);

    component.selectFilterOption(DECK_DETAIL_CARD_FILTER.DUE_IN_2_DAYS);
    expect(component.filteredCards().map((card) => card.id)).toEqual([
      'due-6h',
      'due-12h',
      'due-1d',
      'due-2',
    ]);

    component.selectFilterOption(DECK_DETAIL_CARD_FILTER.NEW);
    expect(component.filteredCards().map((card) => card.id)).toEqual([
      'new-card',
      'new-card-reverse',
    ]);
  });

  it('有反面卡時應顯示方向下拉，且預設文案為全部卡面', () => {
    expect(component.showDirectionFilter()).toBe(true);
    expect(component.selectedDirectionFilterLabel()).toBe('全部卡面');
  });

  it('篩選下拉應提供手機版可視範圍保護設定', () => {
    expect(component.filterOverlayViewportMargin).toBe(16);
    expect(component.filterOverlayPositions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originX: 'end',
          overlayX: 'end',
        }),
        expect.objectContaining({
          originX: 'start',
          overlayX: 'start',
        }),
      ]),
    );
  });

  it('選擇正面卡片或反面卡片時應只顯示對應方向', () => {
    component.selectDirectionFilterOption(DECK_DETAIL_CARD_DIRECTION_FILTER.FORWARD);
    expect(component.filteredCards().map((card) => card.id)).toEqual([
      'overdue',
      'due-6h',
      'due-12h',
      'due-1d',
      'due-2',
      'due-3',
      'new-card',
    ]);

    component.selectDirectionFilterOption(DECK_DETAIL_CARD_DIRECTION_FILTER.REVERSE);
    expect(component.filteredCards().map((card) => card.id)).toEqual(['new-card-reverse']);
  });

  it('只有正面卡時不應顯示方向下拉', () => {
    cardStoreMock.cards.set(createCardStoreMock({ reverse: false }).cards());

    expect(component.showDirectionFilter()).toBe(false);
  });

  it('搜尋、既有篩選與方向篩選應同時生效', () => {
    component.searchTerm.set('target');
    component.selectFilterOption(DECK_DETAIL_CARD_FILTER.NEW);
    component.selectDirectionFilterOption(DECK_DETAIL_CARD_DIRECTION_FILTER.REVERSE);

    expect(component.filteredCards().map((card) => card.id)).toEqual(['new-card-reverse']);
  });

  it('切換方向篩選不應影響排序規則', () => {
    component.selectDirectionFilterOption(DECK_DETAIL_CARD_DIRECTION_FILTER.FORWARD);
    expect(component.filteredCards().map((card) => card.id)).toEqual([
      'overdue',
      'due-6h',
      'due-12h',
      'due-1d',
      'due-2',
      'due-3',
      'new-card',
    ]);

    component.toggleSortDirection();
    expect(component.filteredCards().map((card) => card.id)).toEqual([
      'new-card',
      'due-3',
      'due-2',
      'due-1d',
      'due-12h',
      'due-6h',
      'overdue',
    ]);
  });
});

function createCardStoreMock(options: { reverse?: boolean } = {}) {
  const includeReverse = options.reverse ?? true;
  const cards: CardListItem[] = [
    {
      id: 'new-card',
      cardId: 'card-new',
      direction: 'FORWARD',
      front: 'Target New Card',
      summary: '尚未練習',
      state: 'NEW',
      due: null,
    },
    {
      id: 'due-6h',
      cardId: 'card-due-6h',
      direction: 'FORWARD',
      front: 'Review Soonest',
      summary: 'due in six hours',
      state: 'REVIEW',
      due: '2026-03-01T06:00:00.000Z',
    },
    {
      id: 'due-12h',
      cardId: 'card-due-12h',
      direction: 'FORWARD',
      front: 'Review Within 12h',
      summary: 'due in twelve hours',
      state: 'LEARNING',
      due: '2026-03-01T12:00:00.000Z',
    },
    {
      id: 'due-1d',
      cardId: 'card-due-1d',
      direction: 'FORWARD',
      front: 'Review One Day',
      summary: 'due in one day',
      state: 'REVIEW',
      due: '2026-03-02T00:00:00.000Z',
    },
    {
      id: 'due-2',
      cardId: 'card-due-2',
      direction: 'FORWARD',
      front: 'Review Two Days',
      summary: 'target due in two days',
      state: 'REVIEW',
      due: '2026-03-03T00:00:00.000Z',
    },
    {
      id: 'due-3',
      cardId: 'card-due-3',
      direction: 'FORWARD',
      front: 'Later Card',
      summary: 'outside two days',
      state: 'REVIEW',
      due: '2026-03-04T00:00:00.000Z',
    },
    {
      id: 'overdue',
      cardId: 'card-overdue',
      direction: 'FORWARD',
      front: 'Overdue Card',
      summary: 'already overdue',
      state: 'REVIEW',
      due: '2026-02-28T00:00:00.000Z',
    },
  ];

  if (includeReverse) {
    cards.splice(1, 0, {
      id: 'new-card-reverse',
      cardId: 'card-new',
      direction: 'REVERSE',
      front: 'Target New Card',
      summary: '尚未練習（反面）',
      state: 'NEW',
      due: null,
    });
  }

  return {
    cards: signal<CardListItem[]>(cards),
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
    enableReverse: true,
    stats: {
      newCount: 2,
      reviewCount: 5,
      totalCount: 7,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastStudiedAt: null,
    },
  };
}

function createStudySummary(): StudySummary {
  return {
    totalCards: 7,
    newCount: 2,
    reviewCount: 5,
    todayStudied: 0,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    todayNewStudied: 0,
    todayReviewStudied: 0,
  };
}
