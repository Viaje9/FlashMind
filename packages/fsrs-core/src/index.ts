export type Rating = 'again' | 'hard' | 'easy';

export interface CardState {
  cardId: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  due: Date;
  lastReviewedAt?: Date;
  reviewCount: number;
  lastRating?: Rating;
  authority: 'local' | 'server';
  version: number;
}

export interface ReviewResult {
  state: CardState;
  nextIntervalMinutes: number;
  nextDue: Date;
}

export interface FsrsEngine {
  applyRating(state: CardState, rating: Rating, reviewedAt?: Date): ReviewResult;
}

export interface FsrsConfig {
  stabilityWeights?: Record<Rating, number>;
}

export const createFsrsEngine = (_config: FsrsConfig = {}): FsrsEngine => {
  return {
    applyRating(_state, _rating, _reviewedAt) {
      throw new Error('applyRating not implemented');
    },
  };
};
