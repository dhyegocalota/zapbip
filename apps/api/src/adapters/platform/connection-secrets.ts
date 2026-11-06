import type { ConnectionSecrets, IssuedSecret } from '@zapbip/core';

export function createConnectionSecrets(): ConnectionSecrets {
  return {
    async issue(): Promise<IssuedSecret> {
      throw new Error('ConnectionSecrets.issue is not implemented');
    },
  };
}
