import { unstable_readConfig as readWranglerConfig } from 'wrangler';
import { describe, expect, it } from 'vitest';

const WRANGLER_CONFIG_PATH = 'wrangler.jsonc';
const PRODUCTION_DATABASE_ID_PLACEHOLDER = 'REPLACE_WITH_PRODUCTION_D1_DATABASE_ID';
const DEVELOPMENT_ENVIRONMENT = 'development';
const LOCAL_DATABASE_ID = 'zapbip-connections-local';

type DatabaseBinding = { database_id: string };

function databaseIdsOf(input: { environment?: string }): string[] {
  const { d1_databases: databases } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH, env: input.environment });
  return databases.map((database: DatabaseBinding) => database.database_id);
}

describe('wrangler config', () => {
  it('pin: the top-level production block serves an https origin', () => {
    const { vars } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH });
    expect(vars.PUBLIC_ORIGIN).toMatch(/^https:\/\//);
  });

  it('the production D1 database id is a placeholder that deploy preflight must replace', () => {
    expect(databaseIdsOf({})).toEqual([PRODUCTION_DATABASE_ID_PLACEHOLDER]);
  });

  it('pin: the development environment keeps the local D1 database id', () => {
    expect(databaseIdsOf({ environment: DEVELOPMENT_ENVIRONMENT })).toEqual([LOCAL_DATABASE_ID]);
  });
});
