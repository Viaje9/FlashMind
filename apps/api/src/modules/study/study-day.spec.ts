import { getStartOfStudyDay, getEffectiveDailyLimits, DeckWithOverride } from './study-day';

describe('getStartOfStudyDay', () => {
  it('當前時間已過 resetHour，應回傳今天的 resetHour', () => {
    // 2026-01-20 10:00，resetHour = 4
    const now = new Date('2026-01-20T10:00:00');
    const result = getStartOfStudyDay(now, 4);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(4);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('當前時間尚未到 resetHour，應回傳昨天的 resetHour', () => {
    // 2026-01-20 02:00，resetHour = 4
    const now = new Date('2026-01-20T02:00:00');
    const result = getStartOfStudyDay(now, 4);

    expect(result.getDate()).toBe(19);
    expect(result.getHours()).toBe(4);
  });

  it('當前時間恰好等於 resetHour，應回傳今天的 resetHour', () => {
    // 2026-01-20 04:00:00.000
    const now = new Date('2026-01-20T04:00:00.000');
    const result = getStartOfStudyDay(now, 4);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(4);
  });

  it('resetHour = 0 時，午夜後應回傳今天 0 點', () => {
    const now = new Date('2026-01-20T01:00:00');
    const result = getStartOfStudyDay(now, 0);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(0);
  });

  it('resetHour = 0 時，午夜前 23:59 應回傳今天 0 點', () => {
    const now = new Date('2026-01-20T23:59:00');
    const result = getStartOfStudyDay(now, 0);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(0);
  });

  it('resetHour = 23 時，23:30 應回傳今天 23 點', () => {
    const now = new Date('2026-01-20T23:30:00');
    const result = getStartOfStudyDay(now, 23);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(23);
  });

  it('resetHour = 23 時，22:00 應回傳昨天 23 點', () => {
    const now = new Date('2026-01-20T22:00:00');
    const result = getStartOfStudyDay(now, 23);

    expect(result.getDate()).toBe(19);
    expect(result.getHours()).toBe(23);
  });
});

describe('getEffectiveDailyLimits', () => {
  const baseDeck: DeckWithOverride = {
    dailyNewCards: 20,
    dailyReviewCards: 100,
    dailyResetHour: 4,
    overrideDate: null,
    overrideNewCards: null,
    overrideReviewCards: null,
  };

  it('無覆寫時應回傳預設值', () => {
    const now = new Date('2026-01-20T10:00:00');
    const result = getEffectiveDailyLimits(baseDeck, now);

    expect(result.effectiveNewCards).toBe(20);
    expect(result.effectiveReviewCards).toBe(100);
  });

  it('覆寫有效時應回傳覆寫值', () => {
    const now = new Date('2026-01-20T10:00:00');
    const overrideDate = getStartOfStudyDay(now, 4);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 50,
      overrideReviewCards: 200,
    };
    const result = getEffectiveDailyLimits(deck, now);

    expect(result.effectiveNewCards).toBe(50);
    expect(result.effectiveReviewCards).toBe(200);
  });

  it('覆寫過期時應回傳預設值', () => {
    const yesterday = new Date('2026-01-19T10:00:00');
    const overrideDate = getStartOfStudyDay(yesterday, 4);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 50,
      overrideReviewCards: 200,
    };
    const now = new Date('2026-01-20T10:00:00');
    const result = getEffectiveDailyLimits(deck, now);

    expect(result.effectiveNewCards).toBe(20);
    expect(result.effectiveReviewCards).toBe(100);
  });

  it('部分覆寫時，未覆寫項目使用預設值', () => {
    const now = new Date('2026-01-20T10:00:00');
    const overrideDate = getStartOfStudyDay(now, 4);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 50,
      overrideReviewCards: null,
    };
    const result = getEffectiveDailyLimits(deck, now);

    expect(result.effectiveNewCards).toBe(50);
    expect(result.effectiveReviewCards).toBe(100);
  });

  it('覆寫值低於預設值時應取預設值（安全取大）', () => {
    const now = new Date('2026-01-20T10:00:00');
    const overrideDate = getStartOfStudyDay(now, 4);
    const deck: DeckWithOverride = {
      ...baseDeck,
      overrideDate,
      overrideNewCards: 10,
      overrideReviewCards: 50,
    };
    const result = getEffectiveDailyLimits(deck, now);

    expect(result.effectiveNewCards).toBe(20);
    expect(result.effectiveReviewCards).toBe(100);
  });
});
