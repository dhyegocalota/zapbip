import type { ConnectionDirectory, ConnectionIdentity } from '@zapbip/core';

export class D1ConnectionDirectory implements ConnectionDirectory {
  constructor(input: { database: D1Database }) {
    void input;
  }

  resolveSecretDigest(input: { secretDigest: string }): Promise<ConnectionIdentity | null> {
    void input;
    throw new Error('D1ConnectionDirectory.resolveSecretDigest is not implemented');
  }
}
