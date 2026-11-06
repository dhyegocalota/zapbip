import type { AgentWaker, CoreDependencies, WakeDependencies } from '@zapbip/core';

export function createStandbyAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  void input;
  throw new Error('createStandbyAgentWaker is not implemented');
}
