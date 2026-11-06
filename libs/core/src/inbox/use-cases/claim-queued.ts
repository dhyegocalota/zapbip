import type { Message } from '../message';
import type { CoreDependencies } from '../ports';

export function claimQueued(input: { dependencies: CoreDependencies }): Promise<Message[]> {
  void input;
  throw new Error('claimQueued is not implemented');
}
