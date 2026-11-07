import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig as readConfig } from 'wrangler';

const CONFIG_PATH = join(import.meta.dirname, '..', '..', 'wrangler.jsonc');
const LIMITERS_PER_ENVIRONMENT = 5;
const ENVIRONMENTS = [undefined, 'staging', 'development'];

function namespaceIdsOf(input: { environment: string | undefined }): string[] {
  const config = readConfig({ config: CONFIG_PATH, env: input.environment });
  return config.ratelimits.map((limiter: { namespace_id: string }) => limiter.namespace_id);
}

describe('wrangler rate limiter namespaces', () => {
  it('gives every environment its own namespace ids, so staging traffic never spends production limits', () => {
    const allIds = ENVIRONMENTS.flatMap((environment) => namespaceIdsOf({ environment }));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('keeps five namespaces per environment', () => {
    ENVIRONMENTS.forEach((environment) => expect(namespaceIdsOf({ environment })).toHaveLength(LIMITERS_PER_ENVIRONMENT));
  });
});
