import type { AgentWaker, CoreDependencies, WakeDependencies } from '@zapbip/core';

export function createWebhookAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  void input;
  throw new Error('createWebhookAgentWaker is not implemented');
}
