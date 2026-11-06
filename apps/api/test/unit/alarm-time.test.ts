import { SECOND_MS } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { nextAlarmAt } from '../../src/account-inbox/alarm-time';

const NOW = 1_000_000;
const MIN_DELAY_MS = 5 * SECOND_MS;

describe('nextAlarmAt', () => {
  it('waits the minimum delay when nothing is armed and the item is due', () => {
    expect(nextAlarmAt({ dueAt: NOW - 1, armedAt: null, now: NOW, minDelayMs: MIN_DELAY_MS })).toBe(NOW + MIN_DELAY_MS);
  });

  it('arms at the due time when it is beyond the minimum delay', () => {
    const dueAt = NOW + 10 * MIN_DELAY_MS;
    expect(nextAlarmAt({ dueAt, armedAt: null, now: NOW, minDelayMs: MIN_DELAY_MS })).toBe(dueAt);
  });

  it('never moves an armed alarm later when the item is already due', () => {
    const armedAt = NOW + SECOND_MS;
    expect(nextAlarmAt({ dueAt: NOW - 1, armedAt, now: NOW, minDelayMs: MIN_DELAY_MS })).toBe(armedAt);
  });

  it('moves an armed alarm earlier when a sooner item appears', () => {
    const dueAt = NOW + 10 * MIN_DELAY_MS;
    expect(nextAlarmAt({ dueAt, armedAt: dueAt + 1, now: NOW, minDelayMs: MIN_DELAY_MS })).toBe(dueAt);
  });
});
