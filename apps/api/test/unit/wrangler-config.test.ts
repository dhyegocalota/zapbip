import { experimental_readRawConfig as readRawWranglerConfig, unstable_readConfig as readWranglerConfig } from 'wrangler';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX, SCHEDULED_CRON } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { DEVELOPMENT_ENVIRONMENT } from '../../src/contract/constants';

const WRANGLER_CONFIG_PATH = 'wrangler.jsonc';
const PRODUCTION_DATABASE_ID = '2147fd23-d09d-4609-9c5e-5751453794df';
const STAGING_DATABASE_ID = '7f784389-c79d-46f0-b9ea-2a3eab8aa2ff';
const LOCAL_DATABASE_ID = 'zapbip-connections-local';
const FORBIDDEN_VAR = 'PUBLIC_BASE_URL';
const PRODUCTION_ORIGIN = 'https://mcp.zapbip.com';
const GRAPH_ORIGIN = 'https://graph.facebook.com';
const DEVELOPMENT_ONLY_VAR = 'WHATSAPP_MEDIA_DOWNLOAD_ORIGIN';
const DEPLOYED_BLOCK_MAIN = 'src/index.ts';
const DEVELOPMENT_BLOCK_MAIN = 'src/index.dev.ts';
const EXPECTED_MIGRATIONS = [{ tag: 'v1', new_sqlite_classes: ['AccountInbox'] }];

type DatabaseBinding = { binding: string; database_id: string; database_name: string };
type BucketBinding = { binding: string; bucket_name: string };
type WranglerBlock = {
  name: string;
  main: string;
  routes: unknown;
  d1_databases: DatabaseBinding[];
  r2_buckets: BucketBinding[];
  durable_objects: { bindings: { name: string }[] };
  ratelimits: { name: string }[];
  analytics_engine_datasets: { binding: string }[];
  rules: { globs: string[] }[];
  vars: Record<string, string>;
  migrations: { tag: string }[];
  triggers: { crons: string[] };
};
type WranglerFile = WranglerBlock & { env: Record<DeployEnvironment.Development | DeployEnvironment.Staging, WranglerBlock> };

const wranglerFile: WranglerFile = readRawWranglerConfig({ config: WRANGLER_CONFIG_PATH }).rawConfig as unknown as WranglerFile;
const blocks: Record<DeployEnvironment, WranglerBlock> = {
  [DeployEnvironment.Production]: wranglerFile,
  [DeployEnvironment.Staging]: wranglerFile.env.staging,
  [DeployEnvironment.Development]: wranglerFile.env.development,
};
const blockEntries = Object.entries(blocks) as [DeployEnvironment, WranglerBlock][];

function databaseIdsOf(input: { environment?: string }): string[] {
  const { d1_databases: databases } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH, env: input.environment });
  return databases.map((database: DatabaseBinding) => database.database_id);
}

const BINDING_KEYS: Record<string, (block: WranglerBlock) => string[]> = {
  d1_databases: (block) => block.d1_databases.map((database) => database.binding),
  r2_buckets: (block) => block.r2_buckets.map((bucket) => bucket.binding),
  durable_objects: (block) => block.durable_objects.bindings.map((binding) => binding.name),
  ratelimits: (block) => block.ratelimits.map((limiter) => limiter.name),
  analytics_engine_datasets: (block) => block.analytics_engine_datasets.map((dataset) => dataset.binding),
  rules: (block) => block.rules.map((rule) => rule.globs.join()),
  vars: (block) =>
    Object.keys(block.vars)
      .filter((name) => name !== DEVELOPMENT_ONLY_VAR)
      .sort(),
  migrations: (block) => block.migrations.map((migration) => migration.tag),
  triggers: (block) => block.triggers.crons,
};

describe('wrangler config', () => {
  it('the file declares a staging and a development block', () => {
    expect(Object.keys(wranglerFile.env).sort()).toEqual([DeployEnvironment.Development, DeployEnvironment.Staging]);
  });

  it('pin: the top-level production block serves an https origin', () => {
    const { vars } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH });
    expect(vars.PUBLIC_ORIGIN).toMatch(/^https:\/\//);
  });

  it('the production block carries no development media origin and points at the real Graph host', () => {
    const { vars } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH });
    expect(vars.WHATSAPP_MEDIA_DOWNLOAD_ORIGIN).toBeUndefined();
    expect(vars.WHATSAPP_GRAPH_BASE_URL).toBe(GRAPH_ORIGIN);
  });

  it('the development environment allows downloads from the fake Graph origin', () => {
    const { vars } = readWranglerConfig({ config: WRANGLER_CONFIG_PATH, env: DEVELOPMENT_ENVIRONMENT });
    expect(vars.WHATSAPP_MEDIA_DOWNLOAD_ORIGIN).toBe(vars.WHATSAPP_GRAPH_BASE_URL);
  });

  it('the production D1 database id is the one created on 2026-11-07', () => {
    expect(databaseIdsOf({})).toEqual([PRODUCTION_DATABASE_ID]);
  });

  it('the staging D1 database id is the one created on 2026-11-07', () => {
    expect(databaseIdsOf({ environment: DeployEnvironment.Staging })).toEqual([STAGING_DATABASE_ID]);
  });

  it('pin: the development environment keeps the local D1 database id', () => {
    expect(databaseIdsOf({ environment: DeployEnvironment.Development })).toEqual([LOCAL_DATABASE_ID]);
  });

  it('pins the production block as the top level', () => {
    expect(wranglerFile).toMatchObject({
      name: 'zapbip-api',
      main: DEPLOYED_BLOCK_MAIN,
      routes: [{ pattern: 'mcp.zapbip.com', custom_domain: true }],
      vars: {
        ENVIRONMENT: DeployEnvironment.Production,
        PUBLIC_ORIGIN: PRODUCTION_ORIGIN,
        WAITLIST_ENABLED: 'true',
        WHATSAPP_GRAPH_BASE_URL: GRAPH_ORIGIN,
      },
    });
    expect(wranglerFile.d1_databases.map((database) => database.database_name)).toEqual(['zapbip-production']);
    expect(wranglerFile.r2_buckets.map((bucket) => bucket.bucket_name)).toEqual(['zapbip-media-production', 'zapbip-packages']);
  });

  it('pins the staging block', () => {
    expect(wranglerFile.env.staging).toMatchObject({
      name: 'zapbip-api-staging',
      main: DEPLOYED_BLOCK_MAIN,
      routes: [{ pattern: 'mcp-staging.zapbip.com', custom_domain: true }],
      vars: {
        ENVIRONMENT: DeployEnvironment.Staging,
        PUBLIC_ORIGIN: 'https://mcp-staging.zapbip.com',
        WAITLIST_ENABLED: 'false',
        WHATSAPP_GRAPH_BASE_URL: GRAPH_ORIGIN,
      },
    });
    expect(wranglerFile.env.staging.d1_databases.map((database) => database.database_name)).toEqual(['zapbip-staging']);
    expect(wranglerFile.env.staging.r2_buckets.map((bucket) => bucket.bucket_name)).toEqual([
      'zapbip-media-staging',
      'zapbip-packages-staging',
    ]);
  });

  it('pins the development block as the only one that mounts the simulator', () => {
    expect(wranglerFile.env.development).toMatchObject({
      name: 'zapbip-api-development',
      main: DEVELOPMENT_BLOCK_MAIN,
      vars: { ENVIRONMENT: DeployEnvironment.Development, PUBLIC_ORIGIN: 'http://localhost:8787', WAITLIST_ENABLED: 'false' },
    });
    expect(blockEntries.filter(([, block]) => block.main === DEVELOPMENT_BLOCK_MAIN).map(([environment]) => environment)).toEqual([
      DeployEnvironment.Development,
    ]);
  });

  it.each(Object.entries(BINDING_KEYS))('repeats the %s key set in every block', (_bindingClass, keysOf) => {
    const keySets = blockEntries.map(([, block]) => keysOf(block).join());
    expect(keySets.every((keySet) => keySet === keySets[0])).toBe(true);
  });

  it('declares no forbidden var in any block', () => {
    expect(blockEntries.flatMap(([, block]) => Object.keys(block.vars)).filter((name) => name === FORBIDDEN_VAR)).toEqual([]);
  });

  it('runs the same wrangler migration in every block', () => {
    expect(blockEntries.map(([, block]) => block.migrations)).toEqual([EXPECTED_MIGRATIONS, EXPECTED_MIGRATIONS, EXPECTED_MIGRATIONS]);
  });

  it('declares exactly one cron per block, the shared scheduled tick', () => {
    expect(blockEntries.map(([, block]) => block.triggers.crons)).toEqual(Array(blockEntries.length).fill([SCHEDULED_CRON]));
  });

  it('leaves no placeholder in any deployed block', () => {
    const deployed = [blocks[DeployEnvironment.Staging], blocks[DeployEnvironment.Production]];
    expect(deployed.map((block) => JSON.stringify(block).includes(PLACEHOLDER_VALUE_PREFIX))).toEqual([false, false]);
  });
});
