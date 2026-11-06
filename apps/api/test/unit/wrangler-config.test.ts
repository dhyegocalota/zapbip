import { experimental_readRawConfig as readRawWranglerConfig, unstable_readConfig as readWranglerConfig } from 'wrangler';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX, SCHEDULED_CRON } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { DEVELOPMENT_ENVIRONMENT } from '../../src/contract/constants';

const WRANGLER_CONFIG_PATH = 'wrangler.jsonc';
const PRODUCTION_DATABASE_ID_PLACEHOLDER = 'REPLACE_WITH_PRODUCTION_D1_DATABASE_ID';
const LOCAL_DATABASE_ID = 'zapbip-connections-local';
const FORBIDDEN_VAR = 'PUBLIC_BASE_URL';
const PRODUCTION_ORIGIN = 'https://mcp.zapbip.com';
const GRAPH_ORIGIN = 'https://graph.facebook.com';
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
  rules: (block) => block.rules.map((rule) => rule.globs.join()),
  vars: (block) => Object.keys(block.vars).sort(),
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

  it('the production D1 database id is a placeholder that must be replaced before a deploy', () => {
    expect(databaseIdsOf({})).toEqual([PRODUCTION_DATABASE_ID_PLACEHOLDER]);
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
    expect(wranglerFile.r2_buckets.map((bucket) => bucket.bucket_name)).toEqual(['zapbip-media-production']);
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
    expect(wranglerFile.env.staging.r2_buckets.map((bucket) => bucket.bucket_name)).toEqual(['zapbip-media-staging']);
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

  it('marks every deployed database id and no bucket name with the placeholder prefix', () => {
    const deployed = [blocks[DeployEnvironment.Staging], blocks[DeployEnvironment.Production]];
    expect(
      deployed.flatMap((block) => block.d1_databases.map((database) => database.database_id.startsWith(PLACEHOLDER_VALUE_PREFIX))),
    ).toEqual([true, true]);
    expect(deployed.flatMap((block) => block.r2_buckets.map((bucket) => bucket.bucket_name.startsWith(PLACEHOLDER_VALUE_PREFIX)))).toEqual([
      false,
      false,
    ]);
  });
});
