import type { WakeRepository } from '@zapbip/core';

export function createSqliteWakeRepository(input: { storage: DurableObjectStorage }): WakeRepository {
  void input;
  throw new Error('createSqliteWakeRepository is not implemented');
}
