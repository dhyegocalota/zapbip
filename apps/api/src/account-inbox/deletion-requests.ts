import type { DeletionRequests } from '@zapbip/core';

export function createSqliteDeletionRequests(input: { storage: DurableObjectStorage }): DeletionRequests {
  void input;
  const notImplemented = (): never => {
    throw new Error('createSqliteDeletionRequests is not implemented');
  };
  return { save: notImplemented, find: notImplemented };
}
