import { fsrs, State, type Card as FsrsCard } from 'ts-fsrs';
import { ApiError } from './errors';

type CardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
type Proficiency = 'PROFICIENT' | 'FAIR' | 'UNSTABLE' | 'NEEDS_WORK';

export type CardRow = {
  id: string;
  deckId: string;
  front: string;
  summary: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  state: CardState;
  due: string | null;
  stability: number | null;
  difficulty: number | null;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: string | null;
  learningStep: number;
  reverseState: CardState;
  reverseDue: string | null;
  reverseStability: number | null;
  reverseDifficulty: number | null;
  reverseElapsedDays: number;
  reverseScheduledDays: number;
  reverseReps: number;
  reverseLapses: number;
  reverseLastReview: string | null;
  reverseLearningStep: number;
};

export type MeaningRow = {
  id: string;
  zhMeaning: string;
  enExample: string | null;
  zhExample: string | null;
};

export interface CardStore {
  findDeck(
    id: string,
  ): Promise<{ userId: string; enableReverse: boolean } | null>;
  listCards(deckId: string): Promise<CardRow[]>;
  findCard(id: string): Promise<CardRow | null>;
  listMeanings(cardId: string): Promise<MeaningRow[]>;
}

const scheduler = fsrs();
const stateMap: Record<CardState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

function proficiency(
  card: CardRow,
  direction: 'FORWARD' | 'REVERSE',
  now: Date,
): Proficiency | null {
  const reverse = direction === 'REVERSE';
  const state = reverse ? card.reverseState : card.state;
  const stability = reverse ? card.reverseStability : card.stability;
  const lastReview = reverse ? card.reverseLastReview : card.lastReview;
  if (state === 'NEW' || !stability || !lastReview) return null;
  const due = reverse ? card.reverseDue : card.due;
  const fsrsCard: FsrsCard = {
    due: due ? new Date(due) : now,
    stability,
    difficulty: (reverse ? card.reverseDifficulty : card.difficulty) ?? 0,
    elapsed_days: reverse ? card.reverseElapsedDays : card.elapsedDays,
    scheduled_days: reverse ? card.reverseScheduledDays : card.scheduledDays,
    learning_steps: reverse ? card.reverseLearningStep : card.learningStep,
    reps: reverse ? card.reverseReps : card.reps,
    lapses: reverse ? card.reverseLapses : card.lapses,
    state: stateMap[state],
    last_review: new Date(lastReview),
  };
  const value = scheduler.get_retrievability(fsrsCard, now, false);
  if (value >= 0.9) return 'PROFICIENT';
  if (value >= 0.7) return 'FAIR';
  if (value >= 0.4) return 'UNSTABLE';
  return 'NEEDS_WORK';
}

function listItem(card: CardRow, direction: 'FORWARD' | 'REVERSE', now: Date) {
  const reverse = direction === 'REVERSE';
  const due = reverse ? card.reverseDue : card.due;
  return {
    id: reverse ? `${card.id}:REVERSE` : card.id,
    cardId: card.id,
    direction,
    front: card.front,
    summary: card.summary,
    state: reverse ? card.reverseState : card.state,
    due: due ? new Date(due).toISOString() : null,
    proficiency: proficiency(card, direction, now),
  };
}

export class CardService {
  constructor(
    private readonly store: CardStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async deckAccess(deckId: string, userId: string) {
    const deck = await this.store.findDeck(deckId);
    if (!deck) throw new ApiError('DECK_NOT_FOUND', '找不到此牌組', 404);
    if (deck.userId !== userId) {
      throw new ApiError('FORBIDDEN', '無權限存取此牌組', 403);
    }
    return deck;
  }

  async list(deckId: string, userId: string) {
    const deck = await this.deckAccess(deckId, userId);
    const cards = await this.store.listCards(deckId);
    const now = this.now();
    return cards.flatMap((card) => {
      const forward = listItem(card, 'FORWARD', now);
      return deck.enableReverse
        ? [forward, listItem(card, 'REVERSE', now)]
        : [forward];
    });
  }

  async get(cardId: string, deckId: string, userId: string) {
    await this.deckAccess(deckId, userId);
    const card = await this.store.findCard(cardId);
    if (!card || card.deckId !== deckId) {
      throw new ApiError('CARD_NOT_FOUND', '找不到此卡片', 404);
    }
    const meanings = await this.store.listMeanings(cardId);
    return {
      id: card.id,
      front: card.front,
      note: card.note,
      meanings,
      createdAt: new Date(card.createdAt).toISOString(),
      updatedAt: new Date(card.updatedAt).toISOString(),
    };
  }
}
