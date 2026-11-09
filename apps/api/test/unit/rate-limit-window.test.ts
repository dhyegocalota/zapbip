import { describe, expect, it } from 'vitest';
import { MINUTE_MS, SECOND_MS } from '@zapbip/types';
import { msUntilFreshWindow } from '../support/rate-limit-window';

const MARGIN_MS = 10 * SECOND_MS;

describe('msUntilFreshWindow', () => {
  it('waits for nothing early in a window', () => {
    expect(msUntilFreshWindow({ nowMs: 3 * MINUTE_MS + 5 * SECOND_MS, marginMs: MARGIN_MS })).toBe(0);
  });

  it('waits for nothing when exactly the margin remains', () => {
    expect(msUntilFreshWindow({ nowMs: 3 * MINUTE_MS + MINUTE_MS - MARGIN_MS, marginMs: MARGIN_MS })).toBe(0);
  });

  it('waits for the next window when less than the margin remains', () => {
    expect(msUntilFreshWindow({ nowMs: 4 * MINUTE_MS - 2 * SECOND_MS, marginMs: MARGIN_MS })).toBe(2 * SECOND_MS);
  });

  it('waits for the whole window when the margin exceeds it, right at a boundary', () => {
    expect(msUntilFreshWindow({ nowMs: 4 * MINUTE_MS, marginMs: 2 * MINUTE_MS })).toBe(MINUTE_MS);
  });
});
