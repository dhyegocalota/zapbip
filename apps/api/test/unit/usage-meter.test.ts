import { HOUR_MS } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { gigabyteSecondsForDuration, isBudgetWarning, usageFlushDueAt, utcDay } from '../../src/account-inbox/usage-meter';

const FLUSHED_AT = 1_700_000_000_000;

describe('gigabyte seconds for a duration', () => {
  it('converts one second to the memory size', () => {
    expect(gigabyteSecondsForDuration({ durationMs: 1_000 })).toBe(0.125);
  });

  it('converts zero to zero', () => {
    expect(gigabyteSecondsForDuration({ durationMs: 0 })).toBe(0);
  });

  it('converts a fifty second hold', () => {
    expect(gigabyteSecondsForDuration({ durationMs: 50_000 })).toBe(6.25);
  });

  it('refuses a negative duration', () => {
    expect(() => gigabyteSecondsForDuration({ durationMs: -1 })).toThrow('durationMs must not be negative');
  });
});

describe('budget warning', () => {
  it('stays quiet just below eighty percent', () => {
    expect(isBudgetWarning({ gigabyteSeconds: 10_399.99 })).toBe(false);
  });

  it('warns at eighty percent', () => {
    expect(isBudgetWarning({ gigabyteSeconds: 10_400 })).toBe(true);
  });

  it('warns above the allowance', () => {
    expect(isBudgetWarning({ gigabyteSeconds: 13_001 })).toBe(true);
  });
});

describe('utc day', () => {
  it('keys the last minute of a day', () => {
    expect(utcDay({ now: Date.UTC(2026, 10, 6, 23, 59) })).toBe('2026-11-06');
  });

  it('keys the first millisecond after midnight to the next day', () => {
    expect(utcDay({ now: Date.UTC(2026, 10, 7) + 1 })).toBe('2026-11-07');
  });
});

describe('usage flush due time', () => {
  it('is one hour after the last flush', () => {
    expect(usageFlushDueAt({ lastFlushedAt: FLUSHED_AT, now: FLUSHED_AT + 5 * HOUR_MS })).toBe(FLUSHED_AT + HOUR_MS);
  });

  it('is one hour after now when nothing was flushed', () => {
    expect(usageFlushDueAt({ lastFlushedAt: null, now: FLUSHED_AT })).toBe(FLUSHED_AT + HOUR_MS);
  });
});
