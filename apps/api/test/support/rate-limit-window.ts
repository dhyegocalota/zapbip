import { MINUTE_MS } from '@zapbip/types';

export const RATE_LIMIT_WINDOW_MS = MINUTE_MS;

export function msUntilFreshWindow(input: { nowMs: number; marginMs: number }): number {
  const remainingMs = RATE_LIMIT_WINDOW_MS - (input.nowMs % RATE_LIMIT_WINDOW_MS);
  return remainingMs >= input.marginMs ? 0 : remainingMs;
}

export function startInFreshWindow(input: { marginMs: number }): Promise<void> {
  const waitMs = msUntilFreshWindow({ nowMs: Date.now(), marginMs: input.marginMs });
  return new Promise((resolve) => setTimeout(resolve, waitMs));
}
