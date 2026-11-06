import { WakeStatus } from '@zapbip/types';
import { WAKE_DEBOUNCE_MS, WAKE_FAILED_RETRY_MS, WAKE_MIN_INTERVAL_MS } from './constants';
import type { ScheduleWakeInput } from './wake-ports';

export async function nextWakeDueAt(input: ScheduleWakeInput): Promise<number> {
  const { dependencies, wake, agent } = input;
  const debouncedAt = dependencies.clock.now() + WAKE_DEBOUNCE_MS;
  const lastRequestedAt = await wake.repository.findLastRequestedAt({ agent });
  if (lastRequestedAt === null) return debouncedAt;
  const stored = await wake.repository.findWake({ agent });
  const hasFailed = stored !== null && stored.status === WakeStatus.Failing;
  const gapMs = hasFailed ? WAKE_FAILED_RETRY_MS : WAKE_MIN_INTERVAL_MS;
  return Math.max(debouncedAt, lastRequestedAt + gapMs);
}
