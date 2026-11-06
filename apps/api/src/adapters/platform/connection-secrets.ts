import type { ConnectionSecrets, IssuedSecret } from '@zapbip/core';
import { generateConnectionSecret } from './connection-secret';
import { hashConnectionSecret } from './hash';

export function createConnectionSecrets(): ConnectionSecrets {
  return {
    async issue(): Promise<IssuedSecret> {
      const secret = generateConnectionSecret();
      return { secret, digest: await hashConnectionSecret({ secret }) };
    },
  };
}
