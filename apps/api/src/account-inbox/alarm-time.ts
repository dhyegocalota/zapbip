export function nextAlarmAt(input: { dueAt: number; armedAt: number | null; now: number; minDelayMs: number }): number {
  const { dueAt, armedAt, now, minDelayMs } = input;
  const targetAt = Math.max(dueAt, now + minDelayMs);
  if (armedAt === null) return targetAt;
  return Math.min(armedAt, targetAt);
}
