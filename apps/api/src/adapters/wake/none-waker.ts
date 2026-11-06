import type { AgentWaker } from '@zapbip/core';
import { WakeOutcome } from '@zapbip/types';

export function createNoneWaker(): AgentWaker {
  return { notify: async () => WakeOutcome.Unreached, hasFailedWake: async () => false };
}
