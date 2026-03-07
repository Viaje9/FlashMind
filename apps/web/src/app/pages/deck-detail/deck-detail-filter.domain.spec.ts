import { describe, expect, it } from 'vitest';
import type { CardListItem } from '@flashmind/api-client';
import {
  DECK_DETAIL_CARD_DIRECTION_FILTER,
  filterDeckCards,
  hasReverseCards,
  type DeckDetailCardFilter,
  type DeckDetailCardDirectionFilter,
  DECK_DETAIL_CARD_FILTER,
  sortDeckCards,
} from './deck-detail-filter.domain';

function createCard(
  id: string,
  options: {
    front?: string;
    summary?: string;
    cardId?: string;
    direction?: CardListItem.DirectionEnum;
    state?: CardListItem.StateEnum;
    due?: string | null;
  } = {},
): CardListItem {
  return {
    id,
    cardId: options.cardId ?? id,
    direction: options.direction ?? 'FORWARD',
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
  directionFilter: DeckDetailCardDirectionFilter = DECK_DETAIL_CARD_DIRECTION_FILTER.ALL,
): CardListItem[] {
  return filterDeckCards(cards, {
    filter,
    directionFilter,
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

  it('新卡片篩選應包含反面列表項目', () => {
    const cards = [
      createCard('forward-new', {
        cardId: 'base-1',
        direction: 'FORWARD',
        state: 'NEW',
        due: null,
      }),
      createCard('reverse-new', {
        cardId: 'base-1',
        direction: 'REVERSE',
        state: 'NEW',
        due: null,
      }),
      createCard('reverse-review', {
        cardId: 'base-2',
        direction: 'REVERSE',
        state: 'REVIEW',
        due: '2026-03-02T00:00:00.000Z',
      }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.NEW);

    expect(result.map((card) => card.id)).toEqual(['forward-new', 'reverse-new']);
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

  it('方向篩選為全部卡面時應保留正反向列表項目', () => {
    const cards = [
      createCard('forward-1', { direction: 'FORWARD' }),
      createCard('reverse-1', { direction: 'REVERSE' }),
    ];

    const result = filterBy(cards, DECK_DETAIL_CARD_FILTER.ALL);

    expect(result.map((card) => card.id)).toEqual(['forward-1', 'reverse-1']);
  });

  it('方向篩選為正面卡片時應只回傳 FORWARD 項目', () => {
    const cards = [
      createCard('forward-1', { direction: 'FORWARD' }),
      createCard('reverse-1', { direction: 'REVERSE' }),
      createCard('forward-2', { direction: 'FORWARD' }),
    ];

    const result = filterBy(
      cards,
      DECK_DETAIL_CARD_FILTER.ALL,
      '',
      DECK_DETAIL_CARD_DIRECTION_FILTER.FORWARD,
    );

    expect(result.map((card) => card.id)).toEqual(['forward-1', 'forward-2']);
  });

  it('方向篩選為反面卡片時應只回傳 REVERSE 項目', () => {
    const cards = [
      createCard('forward-1', { direction: 'FORWARD' }),
      createCard('reverse-1', { direction: 'REVERSE' }),
      createCard('reverse-2', { direction: 'REVERSE' }),
    ];

    const result = filterBy(
      cards,
      DECK_DETAIL_CARD_FILTER.ALL,
      '',
      DECK_DETAIL_CARD_DIRECTION_FILTER.REVERSE,
    );

    expect(result.map((card) => card.id)).toEqual(['reverse-1', 'reverse-2']);
  });

  it('方向篩選應與搜尋及既有篩選一起取交集', () => {
    const cards = [
      createCard('forward-match', {
        direction: 'FORWARD',
        front: 'Target',
        due: '2026-03-01T06:00:00.000Z',
      }),
      createCard('reverse-match', {
        direction: 'REVERSE',
        front: 'Target',
        due: '2026-03-01T06:00:00.000Z',
      }),
      createCard('reverse-outside', {
        direction: 'REVERSE',
        front: 'Other',
        due: '2026-03-01T06:00:00.000Z',
      }),
    ];

    const result = filterBy(
      cards,
      DECK_DETAIL_CARD_FILTER.DUE_IN_12_HOURS,
      'target',
      DECK_DETAIL_CARD_DIRECTION_FILTER.REVERSE,
    );

    expect(result.map((card) => card.id)).toEqual(['reverse-match']);
  });

  it('可判斷是否存在反面卡片以決定是否顯示方向選單', () => {
    expect(hasReverseCards([createCard('forward-only', { direction: 'FORWARD' })])).toBe(false);
    expect(
      hasReverseCards([
        createCard('forward-only', { direction: 'FORWARD' }),
        createCard('reverse', { direction: 'REVERSE' }),
      ]),
    ).toBe(true);
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

  it('方向篩選後排序仍應依到期時間升冪', () => {
    const cards = [
      createCard('reverse-no-due', { direction: 'REVERSE', due: null }),
      createCard('forward-early', { direction: 'FORWARD', due: '2026-03-01T03:00:00.000Z' }),
      createCard('reverse-late', { direction: 'REVERSE', due: '2026-03-01T10:00:00.000Z' }),
      createCard('reverse-early', { direction: 'REVERSE', due: '2026-03-01T02:00:00.000Z' }),
    ];

    const filtered = filterBy(
      cards,
      DECK_DETAIL_CARD_FILTER.ALL,
      '',
      DECK_DETAIL_CARD_DIRECTION_FILTER.REVERSE,
    );
    const result = sortDeckCards(filtered, 'asc');

    expect(result.map((card) => card.id)).toEqual([
      'reverse-early',
      'reverse-late',
      'reverse-no-due',
    ]);
  });
});
