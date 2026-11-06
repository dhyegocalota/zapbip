import type { CoreDependencies } from '../ports';

export function findNoticeRetryDueAt(_input: { dependencies: CoreDependencies }): Promise<number | null> {
  throw new Error('findNoticeRetryDueAt is not implemented');
}

export function retryNotice(_input: { dependencies: CoreDependencies }): Promise<void> {
  throw new Error('retryNotice is not implemented');
}
