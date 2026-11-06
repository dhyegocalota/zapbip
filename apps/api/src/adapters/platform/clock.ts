import type { Clock } from '@zapbip/core';

export type DurableClock = Clock & { advance(input: { advanceMs: number }): Promise<number> };

export function createPlatformClock(): Clock {
  throw new Error('createPlatformClock is not implemented');
}

export function loadDurableClock(input: { storage: DurableObjectStorage }): Promise<DurableClock> {
  void input;
  throw new Error('loadDurableClock is not implemented');
}
