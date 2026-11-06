import { scheduleWake, type AgentWaker, type CoreDependencies, type WakeDependencies } from '@zapbip/core';

export function createWebhookAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  return { notify: ({ agent }) => scheduleWake({ dependencies: input.dependencies, wake: input.wake, agent }) };
}
