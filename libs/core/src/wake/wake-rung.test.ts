import { HOUR_MS, WakeMode, WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { scheduledWakeOf, storedWakeOf } from './testing/wake-doubles';
import { wakeRungFor } from './wake-rung';

const NOW = 100 * HOUR_MS;
const AGENT = 'grok-web';
const STANDBY_AGENT = 'grok-bot';
const FRESH_POLL = { lastPolledAt: NOW - HOUR_MS, hasPolled: true, pollerStaleNotified: false, lastStaleNoticeAt: null };
const STALE_POLL = { lastPolledAt: NOW - 2 * HOUR_MS, hasPolled: true, pollerStaleNotified: false, lastStaleNoticeAt: null };

function rung(input: {
  wake: ReturnType<typeof storedWakeOf>;
  pollState?: typeof FRESH_POLL | null;
  standby?: ReturnType<typeof storedWakeOf> | null;
}) {
  const { wake, pollState = null, standby = null } = input;
  return wakeRungFor({ wake, pollState, standby, now: NOW });
}

describe('wakeRungFor', () => {
  test('a webhook wake is on the webhook rung', () => {
    expect(rung({ wake: storedWakeOf({ agent: AGENT, mode: WakeMode.Webhook }) })).toBe(WakeRung.Webhook);
  });

  test('a none wake is on the inbox rung', () => {
    expect(rung({ wake: storedWakeOf({ agent: AGENT, mode: WakeMode.None }) })).toBe(WakeRung.Inbox);
  });

  test('a fresh scheduled wake is on the scheduled rung', () => {
    expect(rung({ wake: scheduledWakeOf({ agent: AGENT }), pollState: FRESH_POLL })).toBe(WakeRung.Scheduled);
  });

  test('a stale scheduled wake is on the inbox rung and its stored mode is untouched', () => {
    const wake = scheduledWakeOf({ agent: AGENT });
    expect(rung({ wake, pollState: STALE_POLL })).toBe(WakeRung.Inbox);
    expect(wake.mode).toBe(WakeMode.Scheduled);
  });

  test('a stale scheduled wake that polled again returns to the scheduled rung', () => {
    const wake = scheduledWakeOf({ agent: AGENT });
    expect(rung({ wake, pollState: STALE_POLL })).toBe(WakeRung.Inbox);
    expect(rung({ wake, pollState: { ...STALE_POLL, lastPolledAt: NOW } })).toBe(WakeRung.Scheduled);
  });

  test('a scheduled wake without a poll state throws', () => {
    expect(() => rung({ wake: scheduledWakeOf({ agent: AGENT }), pollState: null })).toThrow();
  });

  test.each([
    ['a standby that is a webhook wake', storedWakeOf({ agent: STANDBY_AGENT, mode: WakeMode.Webhook }), WakeRung.Standby],
    ['a standby that is missing or revoked', null, WakeRung.Inbox],
    ['a standby that is itself in standby mode', storedWakeOf({ agent: STANDBY_AGENT, mode: WakeMode.Standby }), WakeRung.Inbox],
  ])('a standby wake with %s', (_name, standby, expected) => {
    const wake = storedWakeOf({ agent: AGENT, mode: WakeMode.Standby, standbyAgent: STANDBY_AGENT });
    expect(rung({ wake, standby })).toBe(expected);
  });
});
