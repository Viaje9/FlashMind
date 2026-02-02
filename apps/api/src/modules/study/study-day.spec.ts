import { getStartOfStudyDay, getEffectiveDailyLimits, DeckWithOverride } from './study-day';

describe('getStartOfStudyDay', () => {
  describe('Asia/Taipei (UTC+8)', () => {
    const tz = 'Asia/Taipei';

    it('台北時間已過 resetHour，應回傳今天的 resetHour（UTC）', () => {
      // UTC 07:00 = 台北 15:00，resetHour=4 → 台北今天 04:00 = UTC 前一天 20:00
      const now = new Date('2026-01-20T07:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-19T20:00:00.000Z');
    });

    it('台北時間尚未到 resetHour，應回傳昨天的 resetHour（UTC）', () => {
      // UTC 19:00 = 台北 03:00 (1/21)，resetHour=4 → 台北昨天 04:00 (1/20) = UTC 1/19 20:00
      const now = new Date('2026-01-20T19:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-19T20:00:00.000Z');
    });

    it('台北時間恰好等於 resetHour，應回傳今天的 resetHour（UTC）', () => {
      // UTC 20:00 = 台北 04:00 (1/21)，resetHour=4 → 台北今天 04:00 (1/21) = UTC 1/20 20:00
      const now = new Date('2026-01-20T20:00:00.000Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-20T20:00:00.000Z');
    });

    it('resetHour=0，台北午夜後應回傳今天 0 點（UTC）', () => {
      // UTC 17:00 = 台北 01:00 (1/21)，resetHour=0 → 台北今天 00:00 (1/21) = UTC 1/20 16:00
      const now = new Date('2026-01-20T17:00:00Z');
      const result = getStartOfStudyDay(now, 0, tz);

      expect(result.toISOString()).toBe('2026-01-20T16:00:00.000Z');
    });

    it('resetHour=0，台北午夜前 23:59 應回傳今天 0 點（UTC）', () => {
      // UTC 15:59 = 台北 23:59 (1/20)，resetHour=0 → 台北今天 00:00 (1/20) = UTC 1/19 16:00
      const now = new Date('2026-01-20T15:59:00Z');
      const result = getStartOfStudyDay(now, 0, tz);

      expect(result.toISOString()).toBe('2026-01-19T16:00:00.000Z');
    });

    it('resetHour=23，台北 23:30 應回傳今天 23 點（UTC）', () => {
      // UTC 15:30 = 台北 23:30 (1/20)，resetHour=23 → 台北今天 23:00 (1/20) = UTC 1/20 15:00
      const now = new Date('2026-01-20T15:30:00Z');
      const result = getStartOfStudyDay(now, 23, tz);

      expect(result.toISOString()).toBe('2026-01-20T15:00:00.000Z');
    });

    it('resetHour=23，台北 22:00 應回傳昨天 23 點（UTC）', () => {
      // UTC 14:00 = 台北 22:00 (1/20)，resetHour=23 → 台北昨天 23:00 (1/19) = UTC 1/19 15:00
      const now = new Date('2026-01-20T14:00:00Z');
      const result = getStartOfStudyDay(now, 23, tz);

      expect(result.toISOString()).toBe('2026-01-19T15:00:00.000Z');
    });
  });

  describe('America/New_York (UTC-5 冬令 / UTC-4 夏令)', () => {
    const tz = 'America/New_York';

    it('紐約冬令時間已過 resetHour，應回傳今天的 resetHour（UTC）', () => {
      // UTC 15:00 = 紐約 10:00 (1/20, 冬令 UTC-5)，resetHour=4 → 紐約今天 04:00 = UTC 09:00
      const now = new Date('2026-01-20T15:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-20T09:00:00.000Z');
    });

    it('紐約冬令時間尚未到 resetHour，應回傳昨天的 resetHour（UTC）', () => {
      // UTC 07:00 = 紐約 02:00 (1/20, 冬令 UTC-5)，resetHour=4 → 紐約昨天 04:00 (1/19) = UTC 1/19 09:00
      const now = new Date('2026-01-20T07:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-19T09:00:00.000Z');
    });

    it('紐約夏令時間已過 resetHour，應回傳今天的 resetHour（UTC）', () => {
      // UTC 14:00 = 紐約 10:00 (7/20, 夏令 UTC-4)，resetHour=4 → 紐約今天 04:00 = UTC 08:00
      const now = new Date('2026-07-20T14:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-07-20T08:00:00.000Z');
    });

    it('紐約夏令時間尚未到 resetHour，應回傳昨天的 resetHour（UTC）', () => {
      // UTC 06:00 = 紐約 02:00 (7/20, 夏令 UTC-4)，resetHour=4 → 紐約昨天 04:00 (7/19) = UTC 7/19 08:00
      const now = new Date('2026-07-20T06:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-07-19T08:00:00.000Z');
    });
  });

  describe('UTC', () => {
    const tz = 'UTC';

    it('UTC 已過 resetHour，應回傳今天的 resetHour', () => {
      const now = new Date('2026-01-20T10:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-20T04:00:00.000Z');
    });

    it('UTC 尚未到 resetHour，應回傳昨天的 resetHour', () => {
      const now = new Date('2026-01-20T02:00:00Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-19T04:00:00.000Z');
    });

    it('UTC 恰好等於 resetHour，應回傳今天的 resetHour', () => {
      const now = new Date('2026-01-20T04:00:00.000Z');
      const result = getStartOfStudyDay(now, 4, tz);

      expect(result.toISOString()).toBe('2026-01-20T04:00:00.000Z');
    });
  });
});

describe('getEffectiveDailyLimits', () => {
  const tz = 'Asia/Taipei';

  const baseDeck: DeckWithOverride = {
    dailyNewCards: 20,
    dailyReviewCards: 100,
    dailyResetHour: 4,
    overrideDate: null,
    overrideNewCards: null,
    overrideReviewCards: null,
  };

  it('無覆寫時應回傳預設值', () => {
    const now = new Date('2026-01-20T07:00:00Z'); // 台北 15:00
    const result = getEffectiveDailyLimits(baseDeck, now, tz);

    expect(result.effectiveNewCards).toBe(20);
    expect(result.effectiveReviewCards).toBe(100);
  });

  it('覆寫有效時應回傳覆寫值', () => {
    const now = new Date('2026-01-20T07:00:00Z'); // 台北 15:00
    const overrideDate = getStartOfStudyDay(now, 4, tz);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 50,
      overrideReviewCards: 200,
    };
    const result = getEffectiveDailyLimits(deck, now, tz);

    expect(result.effectiveNewCards).toBe(50);
    expect(result.effectiveReviewCards).toBe(200);
  });

  it('覆寫過期時應回傳預設值', () => {
    const yesterday = new Date('2026-01-19T07:00:00Z'); // 台北 1/19 15:00
    const overrideDate = getStartOfStudyDay(yesterday, 4, tz);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 50,
      overrideReviewCards: 200,
    };
    const now = new Date('2026-01-20T07:00:00Z'); // 台北 1/20 15:00
    const result = getEffectiveDailyLimits(deck, now, tz);

    expect(result.effectiveNewCards).toBe(20);
    expect(result.effectiveReviewCards).toBe(100);
  });

  it('部分覆寫時，未覆寫項目使用預設值', () => {
    const now = new Date('2026-01-20T07:00:00Z');
    const overrideDate = getStartOfStudyDay(now, 4, tz);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 50,
      overrideReviewCards: null,
    };
    const result = getEffectiveDailyLimits(deck, now, tz);

    expect(result.effectiveNewCards).toBe(50);
    expect(result.effectiveReviewCards).toBe(100);
  });

  it('覆寫值低於預設值時應取預設值（安全取大）', () => {
    const now = new Date('2026-01-20T07:00:00Z');
    const overrideDate = getStartOfStudyDay(now, 4, tz);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 10,
      overrideReviewCards: 50,
    };
    const result = getEffectiveDailyLimits(deck, now, tz);

    expect(result.effectiveNewCards).toBe(20);
    expect(result.effectiveReviewCards).toBe(100);
  });
});
