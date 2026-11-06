import { MINUTE_MS, WakeMode } from '@zapbip/types';
import { STALE_POLL_INTERVAL_MULTIPLE } from './constants';
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

export function pollerDeadline(input: { wake: ScheduledWake }): number | null {
  const { wake } = input;
  const isTracked = wake.mode === WakeMode.Scheduled && !wake.pollerStaleNotified;
  if (!isTracked) return null;
  return wake.lastPolledAt + staleAfterMsOf({ wake });
}
