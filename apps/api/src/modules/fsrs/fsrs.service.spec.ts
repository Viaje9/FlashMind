import { FsrsService, CardScheduleState, StudyRating } from './fsrs.service';
import { Rating } from 'ts-fsrs';

describe('FsrsService', () => {
  let service: FsrsService;

  beforeEach(() => {
    service = new FsrsService();
  });

  describe('mapRatingToFsrs', () => {
    it('should map "known" to Rating.Good', () => {
      expect(service.mapRatingToFsrs('known')).toBe(Rating.Good);
    });

    it('should map "unfamiliar" to Rating.Hard', () => {
      expect(service.mapRatingToFsrs('unfamiliar')).toBe(Rating.Hard);
    });

    it('should map "unknown" to Rating.Again', () => {
      expect(service.mapRatingToFsrs('unknown')).toBe(Rating.Again);
    });
  });

  describe('initializeCard', () => {
    it('should return a new card state', () => {
      const state = service.initializeCard();

      expect(state.state).toBe('NEW');
      expect(state.reps).toBe(0);
      expect(state.lapses).toBe(0);
      expect(state.elapsedDays).toBe(0);
      expect(state.scheduledDays).toBe(0);
    });
  });

  describe('calculateNextReview', () => {
    let newCardState: CardScheduleState;
    const now = new Date('2026-01-19T10:00:00Z');

    beforeEach(() => {
      newCardState = service.initializeCard();
    });

    it('should update card state after "known" rating', () => {
      const result = service.calculateNextReview(newCardState, 'known', now);

      expect(result.card.reps).toBe(1);
      expect(result.card.state).not.toBe('NEW');
      expect(result.card.due).toBeDefined();
      expect(result.card.due!.getTime()).toBeGreaterThan(now.getTime());
      expect(result.log.rating).toBe('known');
    });

    it('should update card state after "unfamiliar" rating', () => {
      const result = service.calculateNextReview(newCardState, 'unfamiliar', now);

      expect(result.card.reps).toBe(1);
      expect(result.card.due).toBeDefined();
      expect(result.log.rating).toBe('unfamiliar');
    });

    it('should update card state after "unknown" rating', () => {
      const result = service.calculateNextReview(newCardState, 'unknown', now);

      expect(result.card.reps).toBe(1);
      // 新卡第一次 Again 不算 lapse（只有已學過的卡再次遺忘才算）
      expect(result.card.lapses).toBe(0);
      expect(result.card.due).toBeDefined();
      expect(result.log.rating).toBe('unknown');
    });

    it('should give longest interval for "known" rating', () => {
      const knownResult = service.calculateNextReview(newCardState, 'known', now);
      const unfamiliarResult = service.calculateNextReview(newCardState, 'unfamiliar', now);
      const unknownResult = service.calculateNextReview(newCardState, 'unknown', now);

      expect(knownResult.card.due!.getTime()).toBeGreaterThan(
        unfamiliarResult.card.due!.getTime(),
      );
      expect(unfamiliarResult.card.due!.getTime()).toBeGreaterThan(
        unknownResult.card.due!.getTime(),
      );
    });

    it('should track lapses when reviewed card is forgotten', () => {
      // Simulate a card that has been reviewed and is in REVIEW state
      const reviewedCard: CardScheduleState = {
        state: 'REVIEW',
        due: new Date('2026-01-18T10:00:00Z'),
        stability: 10,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 5,
        reps: 5,
        lapses: 0,
        lastReview: new Date('2026-01-13T10:00:00Z'),
      };

      // When user forgets a reviewed card, it should count as a lapse
      const result = service.calculateNextReview(reviewedCard, 'unknown', now);
      expect(result.card.lapses).toBe(1);
      expect(result.card.state).toBe('RELEARNING');
    });

    it('should include review log with correct data', () => {
      const result = service.calculateNextReview(newCardState, 'known', now);

      expect(result.log).toBeDefined();
      expect(result.log.review).toEqual(now);
      expect(result.log.rating).toBe('known');
      expect(typeof result.log.stability).toBe('number');
      expect(typeof result.log.difficulty).toBe('number');
    });
  });

  describe('isDue', () => {
    const now = new Date('2026-01-19T10:00:00Z');

    it('should return false for new cards', () => {
      const newCard = service.initializeCard();
      expect(service.isDue(newCard, now)).toBe(false);
    });

    it('should return true for cards with due date in the past', () => {
      const reviewedCard: CardScheduleState = {
        state: 'REVIEW',
        due: new Date('2026-01-18T10:00:00Z'), // yesterday
        stability: 1,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        lastReview: new Date('2026-01-17T10:00:00Z'),
      };
      expect(service.isDue(reviewedCard, now)).toBe(true);
    });

    it('should return false for cards with due date in the future', () => {
      const reviewedCard: CardScheduleState = {
        state: 'REVIEW',
        due: new Date('2026-01-20T10:00:00Z'), // tomorrow
        stability: 1,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        lastReview: new Date('2026-01-19T10:00:00Z'),
      };
      expect(service.isDue(reviewedCard, now)).toBe(false);
    });

    it('should return true for cards due exactly now', () => {
      const reviewedCard: CardScheduleState = {
        state: 'REVIEW',
        due: now,
        stability: 1,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        lastReview: new Date('2026-01-18T10:00:00Z'),
      };
      expect(service.isDue(reviewedCard, now)).toBe(true);
    });
  });

  describe('isNew', () => {
    it('should return true for new cards', () => {
      const newCard = service.initializeCard();
      expect(service.isNew(newCard)).toBe(true);
    });

    it('should return false for learning cards', () => {
      const learningCard: CardScheduleState = {
        state: 'LEARNING',
        due: new Date(),
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 1,
        lapses: 0,
        lastReview: new Date(),
      };
      expect(service.isNew(learningCard)).toBe(false);
    });

    it('should return false for review cards', () => {
      const reviewCard: CardScheduleState = {
        state: 'REVIEW',
        due: new Date(),
        stability: 10,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 5,
        reps: 5,
        lapses: 0,
        lastReview: new Date(),
      };
      expect(service.isNew(reviewCard)).toBe(false);
    });
  });
});
