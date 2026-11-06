import type { OwnerWindow } from './inbox-records';

export function isOwnerWindowOpen(input: { window: OwnerWindow; now: number }): boolean {
  void input;
  throw new Error('isOwnerWindowOpen is not implemented');
}
