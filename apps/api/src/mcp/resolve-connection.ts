import type { ConnectionIdentity } from '@zapbip/core';
import { D1ConnectionDirectory } from '../adapters/d1/d1-connection-directory';
import { hashConnectionSecret } from '../adapters/platform/hash';
import { CONNECTION_SECRET_PATTERN } from '../contract/constants';

export async function resolveConnection(input: { database: D1Database; secret: string | null }): Promise<ConnectionIdentity | null> {
  const { secret } = input;
  if (secret === null) return null;
  if (!CONNECTION_SECRET_PATTERN.test(secret)) return null;
  const secretDigest = await hashConnectionSecret({ secret });
  return new D1ConnectionDirectory({ database: input.database }).resolveSecretDigest({ secretDigest });
}
