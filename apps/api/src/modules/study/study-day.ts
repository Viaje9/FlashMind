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
