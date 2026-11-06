import type { AgentWaker, CoreDependencies, WakeDependencies } from '@zapbip/core';

export function createInboxAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  void input;
  throw new Error('createInboxAgentWaker is not implemented');
}
