import type { CardListItem } from '@flashmind/api-client';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

export const DECK_DETAIL_CARD_FILTER = {
  ALL: 'all',
  DUE_IN_12_HOURS: 'due-in-12-hours',
  DUE_IN_1_DAY: 'due-in-1-day',
  DUE_IN_2_DAYS: 'due-in-2-days',
  NEW: 'new',
} as const;

export type DeckDetailCardFilter =
  (typeof DECK_DETAIL_CARD_FILTER)[keyof typeof DECK_DETAIL_CARD_FILTER];

export interface FilterDeckCardsParams {
  searchTerm: string;
  filter: DeckDetailCardFilter;
  now?: Date;
}

export type DeckDetailCardSortDirection = 'asc' | 'desc';

export function filterDeckCards(
  cards: CardListItem[],
  params: FilterDeckCardsParams,
): CardListItem[] {
  const normalizedSearchTerm = params.searchTerm.trim().toLowerCase();
  const now = params.now ?? new Date();

  return cards.filter(
    (card) =>
      matchesSearchTerm(card, normalizedSearchTerm) && matchesFilter(card, params.filter, now),
  );
}

export function sortDeckCards(
  cards: CardListItem[],
  direction: DeckDetailCardSortDirection,
): CardListItem[] {
  const sorted = [...cards].sort(compareByDueThenFront);

  if (direction === 'desc') {
    sorted.reverse();
  }

  return sorted;
}

function matchesSearchTerm(card: CardListItem, normalizedSearchTerm: string): boolean {
  if (!normalizedSearchTerm) {
    return true;
  }

  const front = card.front.toLowerCase();
  const summary = card.summary.toLowerCase();
  return front.includes(normalizedSearchTerm) || summary.includes(normalizedSearchTerm);
}

function matchesFilter(card: CardListItem, filter: DeckDetailCardFilter, now: Date): boolean {
  switch (filter) {
    case DECK_DETAIL_CARD_FILTER.DUE_IN_12_HOURS:
      return isDueWithinHours(card, now, 12);
    case DECK_DETAIL_CARD_FILTER.DUE_IN_1_DAY:
      return isDueWithinDays(card, now, 1);
    case DECK_DETAIL_CARD_FILTER.DUE_IN_2_DAYS:
      return isDueWithinDays(card, now, 2);
    case DECK_DETAIL_CARD_FILTER.NEW:
      return card.state === 'NEW';
    case DECK_DETAIL_CARD_FILTER.ALL:
    default:
      return true;
  }
}

function isDueWithinHours(card: CardListItem, now: Date, hours: number): boolean {
  if (card.state === 'NEW') {
    return false;
  }

  const due = parseDue(card.due);
  if (!due) {
    return false;
  }

  const nowTime = now.getTime();
  const dueTime = due.getTime();
  const maxDueTime = nowTime + hours * HOUR_IN_MS;
  return dueTime >= nowTime && dueTime <= maxDueTime;
}

function isDueWithinDays(card: CardListItem, now: Date, days: number): boolean {
  if (card.state === 'NEW') {
    return false;
  }

  const due = parseDue(card.due);
  if (!due) {
    return false;
  }

  const nowTime = now.getTime();
  const dueTime = due.getTime();
  const maxDueTime = nowTime + days * DAY_IN_MS;
  return dueTime >= nowTime && dueTime <= maxDueTime;
}

function parseDue(due: string | null | undefined): Date | null {
  if (!due) {
    return null;
  }

  const date = new Date(due);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function compareByDueThenFront(left: CardListItem, right: CardListItem): number {
  const leftDueTime = parseDue(left.due)?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightDueTime = parseDue(right.due)?.getTime() ?? Number.POSITIVE_INFINITY;

  if (leftDueTime !== rightDueTime) {
    return leftDueTime - rightDueTime;
  }

  return left.front.localeCompare(right.front, 'zh-Hant', {
    numeric: true,
    sensitivity: 'base',
  });
}
