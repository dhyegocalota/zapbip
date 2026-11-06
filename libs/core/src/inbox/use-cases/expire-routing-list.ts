import type { CoreDependencies } from '../ports';

export async function findRoutingListDueAt(_input: { dependencies: CoreDependencies }): Promise<number | null> {
  throw new Error('findRoutingListDueAt is not implemented');
}

export async function expireRoutingList(_input: { dependencies: CoreDependencies }): Promise<void> {
  throw new Error('expireRoutingList is not implemented');
}
