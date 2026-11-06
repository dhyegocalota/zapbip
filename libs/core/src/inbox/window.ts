import { WINDOW_MS, WINDOW_SAFETY_MARGIN_MS } from './constants';
import type { OwnerWindow } from './inbox-records';

export function isOwnerWindowOpen(input: { window: OwnerWindow; now: number }): boolean {
  if (input.window.lastOwnerMessageAt === null) return false;
  return input.now < input.window.lastOwnerMessageAt + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS;
}
