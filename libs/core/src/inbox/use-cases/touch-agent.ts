import type { AgentName } from '../connection';
import type { CoreDependencies } from '../ports';

export function touchAgent(input: { dependencies: CoreDependencies; agent: AgentName }): Promise<void> {
  void input;
  throw new Error('touchAgent is not implemented');
}
