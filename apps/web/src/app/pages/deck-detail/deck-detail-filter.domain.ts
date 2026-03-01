import type { CardListItem } from '@flashmind/api-client';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const DECK_DETAIL_CARD_FILTER = {
  ALL: 'all',
  DUE_IN_7_DAYS: 'due-in-7-days',
  NEW: 'new',
  DUE_IN_3_DAYS: 'due-in-3-days',
} as const;

export type DeckDetailCardFilter =
  (typeof DECK_DETAIL_CARD_FILTER)[keyof typeof DECK_DETAIL_CARD_FILTER];

export interface FilterDeckCardsParams {
  searchTerm: string;
  filter: DeckDetailCardFilter;
  now?: Date;
}

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
    case DECK_DETAIL_CARD_FILTER.DUE_IN_3_DAYS:
      return isDueWithinDays(card, now, 3);
    case DECK_DETAIL_CARD_FILTER.DUE_IN_7_DAYS:
      return isDueWithinDays(card, now, 7);
    case DECK_DETAIL_CARD_FILTER.NEW:
      return card.state === 'NEW';
    case DECK_DETAIL_CARD_FILTER.ALL:
    default:
      return true;
  }
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
