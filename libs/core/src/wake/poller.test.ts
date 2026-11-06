import { HOUR_MS, WakeMode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { STALE_NOTICE_MAX_GAP_MS } from './constants';
import { isPollerStale, pollerDeadline } from './poller';
import { scheduledWakeOf } from './testing/wake-doubles';

const NOW = 100 * HOUR_MS;
const AGENT = 'chatgpt';

describe('isPollerStale', () => {
  test.each([
    ['one millisecond before twice the interval', 60, 2 * HOUR_MS - 1, false],
    ['exactly twice the interval', 60, 2 * HOUR_MS, true],
    ['twice a two hour interval', 120, 4 * HOUR_MS, true],
    ['under twice a two hour interval', 120, 3 * HOUR_MS, false],
  ])('%s', (_name, intervalMinutes, elapsed, expected) => {
    const wake = scheduledWakeOf({ agent: AGENT, intervalMinutes, lastPolledAt: NOW - elapsed });
    expect(isPollerStale({ wake, now: NOW })).toBe(expected);
  });

  test.each([
    ['twice the interval after creation', 2 * HOUR_MS, true],
    ['one interval after creation', HOUR_MS, false],
  ])('a connection that never polled is counted from its creation: %s', (_name, elapsed, expected) => {
    const wake = scheduledWakeOf({ agent: AGENT, hasPolled: false, lastPolledAt: NOW - elapsed });
    expect(isPollerStale({ wake, now: NOW })).toBe(expected);
  });

  test.each([WakeMode.Webhook, WakeMode.Standby])('a %s wake is never stale', (mode) => {
    const wake = scheduledWakeOf({ agent: AGENT, mode, lastPolledAt: NOW - 10 * HOUR_MS });
    expect(isPollerStale({ wake, now: NOW })).toBe(false);
  });
});

describe('pollerDeadline', () => {
  test('is twice the interval after the last poll', () => {
    const wake = scheduledWakeOf({ agent: AGENT, intervalMinutes: 60, lastPolledAt: NOW });
    expect(pollerDeadline({ wake })).toBe(NOW + 2 * HOUR_MS);
  });

  test('is null once the stale notice was sent', () => {
    expect(pollerDeadline({ wake: scheduledWakeOf({ agent: AGENT, pollerStaleNotified: true }) })).toBeNull();
  });

  test('is null for a standby wake', () => {
    expect(pollerDeadline({ wake: scheduledWakeOf({ agent: AGENT, mode: WakeMode.Standby }) })).toBeNull();
  });

  test.each([6, 7, 20])('A2 caps the gap between notices at the maximum after %i failures', (staleNoticeFailures) => {
    const wake = scheduledWakeOf({ agent: AGENT, intervalMinutes: 60, lastPolledAt: NOW, lastStaleNoticeAt: NOW, staleNoticeFailures });
    expect(pollerDeadline({ wake })).toBe(NOW + STALE_NOTICE_MAX_GAP_MS);
  });
});
