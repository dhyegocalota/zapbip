import { FLUSH_CLAIM_LIMIT } from '../claim-constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';

export function claimQueued(input: { dependencies: CoreDependencies }): Promise<Message[]> {
  const { repository, clock } = input.dependencies;
  return repository.claimQueuedMessages({ claimedAt: clock.now(), limit: FLUSH_CLAIM_LIMIT });
}
