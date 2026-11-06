import type { AgentWaker, CoreDependencies, WakeDependencies } from '@zapbip/core';

export function createScheduledAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  void input;
  throw new Error('createScheduledAgentWaker is not implemented');
}
