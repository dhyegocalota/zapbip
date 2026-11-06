import type { FirstMessageClaim } from '@zapbip/core';

export function createSqliteFirstMessageClaim(input: { storage: DurableObjectStorage }): FirstMessageClaim {
  void input;
  return {
    claim: () => {
      throw new Error('createSqliteFirstMessageClaim is not implemented');
    },
  };
}
