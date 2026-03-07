import { describe, expect, it } from 'vitest';
import type { CardListItem } from '@flashmind/api-client';
import {
  filterDeckCards,
  type DeckDetailCardFilter,
  DECK_DETAIL_CARD_FILTER,
  sortDeckCards,
} from './deck-detail-filter.domain';

function createCard(
  id: string,
  options: {
    front?: string;
    summary?: string;
    state?: CardListItem.StateEnum;
    due?: string | null;
  } = {},
): CardListItem {
  return {
    id,
    front: options.front ?? `front-${id}`,
    summary: options.summary ?? `summary-${id}`,
    state: options.state ?? 'REVIEW',
    due: options.due ?? null,
  };
}

const FIXED_NOW = new Date('2026-03-01T00:00:00.000Z');

function filterBy(
  cards: CardListItem[],
  filter: DeckDetailCardFilter,
  searchTerm = '',
): CardListItem[] {
  return filterDeckCards(cards, {
    filter,
    searchTerm,
    now: FIXED_NOW,
  });
}

describe('deck-detail-filter.domain', () => {
  it('預設全部卡片應回傳所有資料', () => {
    const cards = [
      createCard('c1', { state: 'NEW', due: null }),
      createCard('c2', { state: 'REVIEW', due: '2026-03-03T00:00:00.000Z' }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.ALL);

    expect(result.map((card) => card.id)).toEqual(['c1', 'c2']);
  });

  it('12 小時內到期篩選應包含邊界並排除逾期與 null due', () => {
    const cards = [
      createCard('in-6h', { due: '2026-03-01T06:00:00.000Z' }),
      createCard('in-12h', { due: '2026-03-01T12:00:00.000Z' }),
      createCard('in-13h', { due: '2026-03-01T13:00:00.000Z' }),
      createCard('overdue', { due: '2026-02-28T23:59:59.000Z' }),
      createCard('due-null', { due: null }),
      createCard('new-card', { state: 'NEW', due: null }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.DUE_IN_12_HOURS);

    expect(result.map((card) => card.id)).toEqual(['in-6h', 'in-12h']);
  });

  it('一天內到期篩選應包含邊界並排除超過一天的卡片', () => {
    const cards = [
      createCard('in-12h', { due: '2026-03-01T12:00:00.000Z' }),
      createCard('in-1d', { due: '2026-03-02T00:00:00.000Z' }),
      createCard('in-2d', { due: '2026-03-03T00:00:00.000Z' }),
      createCard('new-card', { state: 'NEW', due: null }),
      createCard('due-null', { due: null }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.DUE_IN_1_DAY);

    expect(result.map((card) => card.id)).toEqual(['in-12h', 'in-1d']);
  });

  it('兩天內到期篩選應只回傳兩天內且非 NEW 卡片', () => {
    const cards = [
      createCard('in-1d', { due: '2026-03-02T00:00:00.000Z' }),
      createCard('in-2d', { due: '2026-03-03T00:00:00.000Z' }),
      createCard('in-3d', { due: '2026-03-04T00:00:00.000Z' }),
      createCard('new-card', { state: 'NEW', due: null }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.DUE_IN_2_DAYS);

    expect(result.map((card) => card.id)).toEqual(['in-1d', 'in-2d']);
  });

  it('新卡片篩選應只回傳 state=NEW', () => {
    const cards = [
      createCard('new-1', { state: 'NEW', due: null }),
      createCard('new-2', { state: 'NEW', due: null }),
      createCard('review', { state: 'REVIEW', due: '2026-03-02T00:00:00.000Z' }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.NEW);

    expect(result.map((card) => card.id)).toEqual(['new-1', 'new-2']);
  });

  it('搜尋條件應與篩選條件取交集（同時生效）', () => {
    const cards = [
      createCard('due-match', {
        front: 'Target Card',
        summary: '會在兩天內到期',
        due: '2026-03-02T00:00:00.000Z',
      }),
      createCard('due-no-keyword', {
        front: 'Another',
        summary: '也在兩天內',
        due: '2026-03-03T00:00:00.000Z',
      }),
      createCard('keyword-no-due', {
        front: 'Target New Card',
        summary: '新卡',
        state: 'NEW',
        due: null,
      }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.DUE_IN_2_DAYS, 'target');

    expect(result.map((card) => card.id)).toEqual(['due-match']);
  });

  it('排序應以到期時間升冪，並將沒有 due 的卡片放在最後', () => {
    const cards = [
      createCard('no-due', { front: 'No Due', due: null }),
      createCard('due-late', { front: 'Late', due: '2026-03-05T00:00:00.000Z' }),
      createCard('due-early', { front: 'Early', due: '2026-03-02T00:00:00.000Z' }),
    ];

    const result = sortDeckCards(cards, 'asc');

    expect(result.map((card) => card.id)).toEqual(['due-early', 'due-late', 'no-due']);
  });

  it('排序應以到期時間降冪（由升冪反轉）', () => {
    const cards = [
      createCard('no-due', { front: 'No Due', due: null }),
      createCard('due-late', { front: 'Late', due: '2026-03-05T00:00:00.000Z' }),
      createCard('due-early', { front: 'Early', due: '2026-03-02T00:00:00.000Z' }),
    ];

    const result = sortDeckCards(cards, 'desc');

    expect(result.map((card) => card.id)).toEqual(['no-due', 'due-late', 'due-early']);
  });
});
