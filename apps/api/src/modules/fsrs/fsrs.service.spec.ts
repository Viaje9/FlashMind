import { FsrsService, CardScheduleState, StudyRating, DeckFsrsParams } from './fsrs.service';
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
        learningStep: 0,
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
        learningStep: 0,
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
        learningStep: 0,
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
        learningStep: 0,
      };
      expect(service.isDue(reviewedCard, now)).toBe(true);
    });
  });

  describe('getScheduler', () => {
    it('應該在沒有參數時回傳預設排程器', () => {
      const scheduler = service.getScheduler();
      expect(scheduler).toBeDefined();
    });

    it('應該根據不同參數建立不同排程器', () => {
      const params1: DeckFsrsParams = {
        requestRetention: 0.85,
        maximumInterval: 180,
      };
      const params2: DeckFsrsParams = {
        requestRetention: 0.95,
        maximumInterval: 365,
      };
      const scheduler1 = service.getScheduler(params1);
      const scheduler2 = service.getScheduler(params2);
      expect(scheduler1).toBeDefined();
      expect(scheduler2).toBeDefined();
      expect(scheduler1).not.toBe(scheduler2);
    });

    it('應該快取相同參數的排程器', () => {
      const params: DeckFsrsParams = {
        requestRetention: 0.85,
        maximumInterval: 180,
      };
      const scheduler1 = service.getScheduler(params);
      const scheduler2 = service.getScheduler(params);
      expect(scheduler1).toBe(scheduler2);
    });

    it('應該在沒有參數時每次回傳相同的預設排程器', () => {
      const scheduler1 = service.getScheduler();
      const scheduler2 = service.getScheduler();
      expect(scheduler1).toBe(scheduler2);
    });
  });

  describe('calculateNextReview with fsrsParams', () => {
    const now = new Date('2026-01-19T10:00:00Z');

    it('應該使用自訂 FSRS 參數計算排程', () => {
      const newCard = service.initializeCard();
      const params: DeckFsrsParams = {
        requestRetention: 0.85,
        maximumInterval: 180,
      };

      const result = service.calculateNextReview(newCard, 'known', now, params);

      expect(result.card.reps).toBe(1);
      expect(result.card.state).not.toBe('NEW');
      expect(result.card.due).toBeDefined();
    });

    it('不同保留率應產生不同的排程結果', () => {
      // 建立一張已進入 REVIEW 狀態的卡片
      const reviewCard: CardScheduleState = {
        state: 'REVIEW',
        due: new Date('2026-01-18T10:00:00Z'),
        stability: 10,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 5,
        reps: 5,
        lapses: 0,
        lastReview: new Date('2026-01-13T10:00:00Z'),
        learningStep: 0,
      };

      const highRetention: DeckFsrsParams = { requestRetention: 0.95, maximumInterval: 36500 };
      const lowRetention: DeckFsrsParams = { requestRetention: 0.70, maximumInterval: 36500 };

      const highResult = service.calculateNextReview(reviewCard, 'known', now, highRetention);
      const lowResult = service.calculateNextReview(reviewCard, 'known', now, lowRetention);

      // 較高保留率應該產生更短的間隔（更頻繁的複習）
      expect(highResult.card.scheduledDays).toBeLessThanOrEqual(lowResult.card.scheduledDays);
    });
  });

  describe('initializeCard learningStep', () => {
    it('初始化卡片應包含 learningStep 為 0', () => {
      const state = service.initializeCard();
      expect(state.learningStep).toBe(0);
    });
  });

  describe('calculateNextReview with learningSteps', () => {
    const now = new Date('2026-01-19T10:00:00Z');

    it('回傳結果應包含 learningStep 欄位', () => {
      const newCard = service.initializeCard();
      const result = service.calculateNextReview(newCard, 'known', now);
      expect(result.card).toHaveProperty('learningStep');
      expect(typeof result.card.learningStep).toBe('number');
    });

    it('使用自訂 learningSteps 時應影響 LEARNING 卡片排程', () => {
      const newCard = service.initializeCard();
      const params: DeckFsrsParams = {
        learningSteps: ['1m', '10m'],
      };

      // 第一次評分 unknown → 進入 LEARNING
      const result = service.calculateNextReview(newCard, 'unknown', now, params);
      expect(result.card.state).toBe('LEARNING');
    });

    it('自訂 learningSteps 的排程器應被正確快取', () => {
      const params1: DeckFsrsParams = {
        requestRetention: 0.9,
        learningSteps: ['1m', '10m'],
      };
      const params2: DeckFsrsParams = {
        requestRetention: 0.9,
        learningSteps: ['5m', '15m'],
      };
      const params1Copy: DeckFsrsParams = {
        requestRetention: 0.9,
        learningSteps: ['1m', '10m'],
      };

      const scheduler1 = service.getScheduler(params1);
      const scheduler2 = service.getScheduler(params2);
      const scheduler1Again = service.getScheduler(params1Copy);

      expect(scheduler1).not.toBe(scheduler2);
      expect(scheduler1).toBe(scheduler1Again);
    });

    it('自訂 relearningSteps 的排程器應被正確快取', () => {
      const params1: DeckFsrsParams = {
        relearningSteps: ['10m'],
      };
      const params2: DeckFsrsParams = {
        relearningSteps: ['5m', '30m'],
      };

      const scheduler1 = service.getScheduler(params1);
      const scheduler2 = service.getScheduler(params2);

      expect(scheduler1).not.toBe(scheduler2);
    });
  });

  describe('parseLearningSteps', () => {
    it('應該解析單一步驟', () => {
      expect(service.parseLearningSteps('10m')).toEqual(['10m']);
    });

    it('應該解析多個步驟', () => {
      expect(service.parseLearningSteps('1m,10m')).toEqual(['1m', '10m']);
    });

    it('應該解析含空白的步驟字串', () => {
      expect(service.parseLearningSteps(' 1m , 10m , 1h ')).toEqual(['1m', '10m', '1h']);
    });

    it('應該解析包含不同時間單位的步驟', () => {
      expect(service.parseLearningSteps('1m,10m,1h,1d')).toEqual(['1m', '10m', '1h', '1d']);
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
        learningStep: 1,
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
        learningStep: 0,
      };
      expect(service.isNew(reviewCard)).toBe(false);
    });
  });
});
