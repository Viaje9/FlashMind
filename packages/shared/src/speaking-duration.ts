/** 起訖涵蓋的估算分鐘數；0 表示不到一分鐘，null 表示時間不完整。 */
export function estimateSpeakingDurationMinutes(
  startedAt?: string | null,
  endedAt?: string | null,
): number | null {
  if (!startedAt || !endedAt) return null;
  const elapsedMs = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  return elapsedMs < 60_000 ? 0 : Math.round(elapsedMs / 60_000);
}
