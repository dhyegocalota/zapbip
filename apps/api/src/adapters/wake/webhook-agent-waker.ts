import { scheduleWake, type AgentWaker, type CoreDependencies, type WakeDependencies } from '@zapbip/core';
import { WakeStatus } from '@zapbip/types';

export function createWebhookAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  const { dependencies, wake } = input;
  return {
    notify: ({ agent }) => scheduleWake({ dependencies, wake, agent }),
    pushesEveryMessage: async () => false,
    hasFailedWake: async ({ agent }) => {
      const stored = await wake.repository.findWake({ agent });
      return stored !== null && stored.status === WakeStatus.Failing;
    },
  };
}
