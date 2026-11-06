import { WAKE_DEBOUNCE_MS, WAKE_MIN_INTERVAL_MS } from './constants';
import type { ScheduleWakeInput } from './wake-ports';

export async function nextWakeDueAt(input: ScheduleWakeInput): Promise<number> {
  const { dependencies, wake, agent } = input;
  const debouncedAt = dependencies.clock.now() + WAKE_DEBOUNCE_MS;
  const lastRequestedAt = await wake.repository.findLastRequestedAt({ agent });
  if (lastRequestedAt === null) return debouncedAt;
  return Math.max(debouncedAt, lastRequestedAt + WAKE_MIN_INTERVAL_MS);
}
