/**
 * 計算學習日的起始時間。
 *
 * 若現在時間還沒到今天的 resetHour，則學習日起始為「昨天的 resetHour」；
 * 否則為「今天的 resetHour」。
 */
export function getStartOfStudyDay(now: Date, resetHour: number): Date {
  const start = new Date(now);
  start.setHours(resetHour, 0, 0, 0);

  if (now < start) {
    // 還沒到今天的重置時間，學習日起始為昨天的 resetHour
    start.setDate(start.getDate() - 1);
  }

  return start;
}

export interface DeckWithOverride {
  dailyNewCards: number;
  dailyReviewCards: number;
  dailyResetHour: number;
  overrideDate: Date | null;
  overrideNewCards: number | null;
  overrideReviewCards: number | null;
}

/**
 * 計算有效的每日上限，考慮覆寫值。
 *
 * - 若 overrideDate 等於當前學習日起始時間，使用覆寫值
 * - 取 max(overrideValue, defaultValue) 確保覆寫不會降低上限
 * - 覆寫無效或不存在時，使用牌組預設值
 */
export function getEffectiveDailyLimits(
  deck: DeckWithOverride,
  now: Date = new Date(),
): { effectiveNewCards: number; effectiveReviewCards: number } {
  const studyDayStart = getStartOfStudyDay(now, deck.dailyResetHour);
  const isOverrideActive =
    deck.overrideDate !== null &&
    deck.overrideDate.getTime() === studyDayStart.getTime();

  return {
    effectiveNewCards:
      isOverrideActive && deck.overrideNewCards != null
        ? Math.max(deck.overrideNewCards, deck.dailyNewCards)
        : deck.dailyNewCards,
    effectiveReviewCards:
      isOverrideActive && deck.overrideReviewCards != null
        ? Math.max(deck.overrideReviewCards, deck.dailyReviewCards)
        : deck.dailyReviewCards,
  };
}
