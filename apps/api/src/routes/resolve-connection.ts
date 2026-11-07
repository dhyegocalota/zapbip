import { D1ConnectionDirectory, type ConnectionWithActivity } from '../adapters/d1/d1-connection-directory';
import { hashConnectionSecret } from '../adapters/platform/hash';
import { CONNECTION_SECRET_PATTERN } from '../contract/constants';

export type ResolvedConnection = ConnectionWithActivity & { secret: string; secretDigest: string };

export async function resolveConnection(input: { database: D1Database; secret: string | null }): Promise<ResolvedConnection | null> {
  const { secret } = input;
  if (secret === null) return null;
  if (!CONNECTION_SECRET_PATTERN.test(secret)) return null;
  const secretDigest = await hashConnectionSecret({ secret });
  const resolved = await new D1ConnectionDirectory({ database: input.database }).resolveWithActivity({ secretDigest });
  if (!resolved) return null;
  return { ...resolved, secret, secretDigest };
}
