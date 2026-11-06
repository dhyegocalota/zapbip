import { MINUTE_MS, WakeMode } from '@zapbip/types';
import { STALE_NOTICE_BACKOFF_FACTOR, STALE_NOTICE_MAX_GAP_MS, STALE_NOTICE_MIN_GAP_MS, STALE_POLL_INTERVAL_MULTIPLE } from './constants';
import type { ScheduledWake } from './wake-setting';

function staleAfterMsOf(input: { wake: ScheduledWake }): number {
  const { intervalMinutes } = input.wake;
  if (intervalMinutes === null) throw new Error(`scheduled wake of ${input.wake.agent} has no interval`);
  return STALE_POLL_INTERVAL_MULTIPLE * intervalMinutes * MINUTE_MS;
}

export function isPollerStale(input: { wake: ScheduledWake; now: number }): boolean {
  const { wake, now } = input;
  if (wake.mode !== WakeMode.Scheduled) return false;
  return now >= wake.lastPolledAt + staleAfterMsOf({ wake });
}

function staleNoticeGapMs(input: { failures: number }): number {
  const retries = Math.max(input.failures - 1, 0);
  return Math.min(STALE_NOTICE_MIN_GAP_MS * STALE_NOTICE_BACKOFF_FACTOR ** retries, STALE_NOTICE_MAX_GAP_MS);
}

export function pollerDeadline(input: { wake: ScheduledWake }): number | null {
  const { wake } = input;
  const isTracked = wake.mode === WakeMode.Scheduled && !wake.pollerStaleNotified;
  if (!isTracked) return null;
  const staleAt = wake.lastPolledAt + staleAfterMsOf({ wake });
  if (wake.lastStaleNoticeAt === null) return staleAt;
  return Math.max(staleAt, wake.lastStaleNoticeAt + staleNoticeGapMs({ failures: wake.staleNoticeFailures }));
}

export function isStaleNoticeDue(input: { wake: ScheduledWake; now: number }): boolean {
  const deadline = pollerDeadline({ wake: input.wake });
  return deadline !== null && input.now >= deadline;
}
