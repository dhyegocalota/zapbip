import type { AgentName } from '../connection';
import type { CoreDependencies } from '../ports';

export function touchAgent(input: { dependencies: CoreDependencies; agent: AgentName }): Promise<void> {
  const { repository, clock } = input.dependencies;
  return repository.registerAgent({ agent: input.agent, seenAt: clock.now() });
}
