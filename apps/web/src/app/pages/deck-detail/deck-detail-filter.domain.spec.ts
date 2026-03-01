import { describe, expect, it } from 'vitest';
import type { CardListItem } from '@flashmind/api-client';
import {
  filterDeckCards,
  type DeckDetailCardFilter,
  DECK_DETAIL_CARD_FILTER,
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

  it('七天內到期篩選應包含邊界並排除逾期與 null due', () => {
    const cards = [
      createCard('in-2', { due: '2026-03-03T00:00:00.000Z' }),
      createCard('in-7', { due: '2026-03-08T00:00:00.000Z' }),
      createCard('in-8', { due: '2026-03-09T00:00:00.000Z' }),
      createCard('overdue', { due: '2026-02-28T23:59:59.000Z' }),
      createCard('due-null', { due: null }),
      createCard('new-card', { state: 'NEW', due: null }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.DUE_IN_7_DAYS);

    expect(result.map((card) => card.id)).toEqual(['in-2', 'in-7']);
  });

  it('三天內到期篩選應包含邊界並排除非 NEW 但超過 3 天', () => {
    const cards = [
      createCard('in-1', { due: '2026-03-02T00:00:00.000Z' }),
      createCard('in-3', { due: '2026-03-04T00:00:00.000Z' }),
      createCard('in-4', { due: '2026-03-05T00:00:00.000Z' }),
      createCard('new-card', { state: 'NEW', due: null }),
      createCard('due-null', { due: null }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.DUE_IN_3_DAYS);

    expect(result.map((card) => card.id)).toEqual(['in-1', 'in-3']);
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
        summary: '會在七天內到期',
        due: '2026-03-04T00:00:00.000Z',
      }),
      createCard('due-no-keyword', {
        front: 'Another',
        summary: '也在七天內',
        due: '2026-03-05T00:00:00.000Z',
      }),
      createCard('keyword-no-due', {
        front: 'Target New Card',
        summary: '新卡',
        state: 'NEW',
        due: null,
      }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.DUE_IN_7_DAYS, 'target');

    expect(result.map((card) => card.id)).toEqual(['due-match']);
  });
});
