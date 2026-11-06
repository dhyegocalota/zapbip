import type { Clock, WakeRepository } from '@zapbip/core';

export function createSqliteWakeRepository(input: { storage: DurableObjectStorage; clock: Clock }): WakeRepository {
  void input;
  throw new Error('createSqliteWakeRepository is not implemented');
}
