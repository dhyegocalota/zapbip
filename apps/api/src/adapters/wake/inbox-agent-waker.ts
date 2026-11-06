import type { AgentWaker, CoreDependencies, WakeDependencies } from '@zapbip/core';
import { WakeMode, WakeOutcome } from '@zapbip/types';
import { sendExpectedDelayNote } from './scheduled-agent-waker';

export function createInboxAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  const { dependencies, wake } = input;
  return {
    notify: async ({ agent }) => {
      const stored = await wake.repository.findWake({ agent });
      const isStaleScheduled = stored !== null && stored.mode === WakeMode.Scheduled;
      if (isStaleScheduled) await sendExpectedDelayNote({ dependencies, wake, agent });
      return WakeOutcome.Unreached;
    },
  };
}
