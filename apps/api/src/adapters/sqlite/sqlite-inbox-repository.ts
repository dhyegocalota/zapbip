import type { InboxRepository } from '@zapbip/core';

export function createSqliteInboxRepository(input: { storage: DurableObjectStorage }): InboxRepository {
  void input;
  throw new Error('createSqliteInboxRepository is not implemented');
}
