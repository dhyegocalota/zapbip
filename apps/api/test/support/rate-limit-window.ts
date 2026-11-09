import { MINUTE_MS } from '@zapbip/types';

export const RATE_LIMIT_WINDOW_MS = MINUTE_MS;

export function waitUntilWindowRemains(input: { remainingMs: number }): Promise<void> {
  const elapsed = Date.now() % RATE_LIMIT_WINDOW_MS;
  const untilTarget = (RATE_LIMIT_WINDOW_MS - input.remainingMs - elapsed + RATE_LIMIT_WINDOW_MS) % RATE_LIMIT_WINDOW_MS;
  return new Promise((resolve) => setTimeout(resolve, untilTarget));
}
