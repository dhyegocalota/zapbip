import { unstable_readConfig as readWranglerConfig } from 'wrangler';
import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_ENVIRONMENT } from '../../src/contract/constants';

const WRANGLER_CONFIG_PATH = 'wrangler.jsonc';
const PRODUCTION_DATABASE_ID_PLACEHOLDER = 'REPLACE_WITH_PRODUCTION_D1_DATABASE_ID';
const LOCAL_DATABASE_ID = 'zapbip-connections-local';
const PRODUCTION_GRAPH_BASE_URL = 'https://graph.facebook.com';

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

  it('the production block carries no development media origin and points at the real Graph host', () => {
    const { vars } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH });
    expect(vars.WHATSAPP_MEDIA_DOWNLOAD_ORIGIN).toBeUndefined();
    expect(vars.WHATSAPP_GRAPH_BASE_URL).toBe(PRODUCTION_GRAPH_BASE_URL);
  });

  it('the development environment allows downloads from the fake Graph origin', () => {
    const { vars } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH, env: DEVELOPMENT_ENVIRONMENT });
    expect(vars.WHATSAPP_MEDIA_DOWNLOAD_ORIGIN).toBe(vars.WHATSAPP_GRAPH_BASE_URL);
  });

  it('the production D1 database id is a placeholder that must be replaced before a deploy', () => {
    expect(databaseIdsOf({})).toEqual([PRODUCTION_DATABASE_ID_PLACEHOLDER]);
  });

  it('pin: the development environment keeps the local D1 database id', () => {
    expect(databaseIdsOf({ environment: DEVELOPMENT_ENVIRONMENT })).toEqual([LOCAL_DATABASE_ID]);
  });
});
