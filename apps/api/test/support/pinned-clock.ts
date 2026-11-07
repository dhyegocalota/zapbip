import { vi } from 'vitest';

export const MIDDAY_START = Date.UTC(2026, 10, 7, 12);
export const SHORTLY_BEFORE_MIDNIGHT_START = Date.UTC(2026, 10, 7, 23, 59, 30);

const realNow = Date.now.bind(Date);

export function pinClockAt(input: { at: number }): void {
  const offset = input.at - realNow();
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
}
