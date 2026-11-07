import { WINDOW_MS, WINDOW_SAFETY_MARGIN_MS } from './constants';
import type { OwnerWindow } from './inbox-records';

export function isOwnerWindowOpen(input: { window: OwnerWindow; now: number }): boolean {
  const { window, now } = input;
  if (window.lastOwnerMessageAt === null) return false;
  const isClosedByChannel = window.closedAt !== null && now >= window.closedAt;
  if (isClosedByChannel) return false;
  return now < window.lastOwnerMessageAt + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS;
}
