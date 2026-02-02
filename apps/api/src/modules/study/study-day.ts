/**
 * 從 Intl.DateTimeFormat.formatToParts 取得使用者時區的日期時間組件。
 */
function getLocalDateParts(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };

  // hour12: false 時，午夜可能回傳 24，需正規化為 0
  const rawHour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: get('minute'),
  };
}

/**
 * 將使用者本地時間轉為 UTC Date。
 * 使用迭代修正法處理 DST 邊界。
 */
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // 先用 UTC 建立一個近似的 Date
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // 取得該 guess 在目標時區的實際時間
  const local = getLocalDateParts(guess, timezone);

  // 計算偏差（毫秒）
  const guessLocal = new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      0,
      0,
    ),
  );
  const diffMs = guess.getTime() - guessLocal.getTime();

  // 修正
  const corrected = new Date(guess.getTime() + diffMs);

  // 驗證修正後確實是正確的本地時間（處理 DST 不連續情況）
  const verify = getLocalDateParts(corrected, timezone);
  if (verify.hour !== hour || verify.day !== day) {
    // DST 不連續，再修正一次
    const verifyLocal = new Date(
      Date.UTC(
        verify.year,
        verify.month - 1,
        verify.day,
        verify.hour,
        verify.minute,
        0,
        0,
      ),
    );
    const diffMs2 = corrected.getTime() - verifyLocal.getTime();
    return new Date(corrected.getTime() + diffMs2);
  }

  return corrected;
}

/**
 * 計算學習日的起始時間（時區感知）。
 *
 * 若使用者本地時間還沒到今天的 resetHour，則學習日起始為「昨天的 resetHour」；
 * 否則為「今天的 resetHour」。
 *
 * @returns UTC Date
 */
export function getStartOfStudyDay(
  now: Date,
  resetHour: number,
  timezone: string,
): Date {
  const local = getLocalDateParts(now, timezone);

  // 計算今天 resetHour 的 UTC 時間
  const todayReset = localToUtc(
    local.year,
    local.month,
    local.day,
    resetHour,
    0,
    timezone,
  );

  if (now >= todayReset) {
    return todayReset;
  }

  // 還沒到今天的重置時間，學習日起始為昨天的 resetHour
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yLocal = getLocalDateParts(yesterday, timezone);
  return localToUtc(
    yLocal.year,
    yLocal.month,
    yLocal.day,
    resetHour,
    0,
    timezone,
  );
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
  timezone: string,
): { effectiveNewCards: number; effectiveReviewCards: number } {
  const studyDayStart = getStartOfStudyDay(now, deck.dailyResetHour, timezone);
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
