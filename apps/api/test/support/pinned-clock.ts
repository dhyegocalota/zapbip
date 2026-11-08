import { vi } from 'vitest';

export const MIDDAY_START = Date.UTC(2030, 0, 1, 12);
export const HALF_AN_HOUR_BEFORE_MIDNIGHT_START = Date.UTC(2030, 0, 1, 23, 30);

const realNow = Date.now.bind(Date);

export function pinClockAt(input: { at: number }): void {
  const offset = input.at - realNow();
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
}
