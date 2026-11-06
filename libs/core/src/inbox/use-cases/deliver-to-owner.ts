import type { DeliverToOwnerInput, DeliverToOwnerResult } from './types';

export function deliverToOwner(input: DeliverToOwnerInput): Promise<DeliverToOwnerResult> {
  void input;
  throw new Error('deliverToOwner is not implemented');
}
