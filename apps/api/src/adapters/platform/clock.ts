import type { Clock } from '@zapbip/core';
import { CLOCK_OFFSET_STORAGE_KEY } from '../../contract/constants';

export type DurableClock = Clock & { advance(input: { advanceMs: number }): Promise<number> };

function scheduleTimer(input: { delayMs: number; run: () => void }): { cancel: () => void } {
  const timer = setTimeout(input.run, input.delayMs);
  return { cancel: () => clearTimeout(timer) };
}

export function createPlatformClock(): Clock {
  return { now: () => Date.now(), schedule: scheduleTimer };
}

export async function loadDurableClock(input: { storage: DurableObjectStorage }): Promise<DurableClock> {
  const storedOffsetMs = await input.storage.get<number>(CLOCK_OFFSET_STORAGE_KEY);
  let offsetMs = storedOffsetMs === undefined ? 0 : storedOffsetMs;
  return {
    now: () => Date.now() + offsetMs,
    schedule: scheduleTimer,
    advance: async ({ advanceMs }) => {
      offsetMs += advanceMs;
      await input.storage.put(CLOCK_OFFSET_STORAGE_KEY, offsetMs);
      return offsetMs;
    },
  };
}
