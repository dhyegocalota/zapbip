import { readFileSync } from 'node:fs';
import { experimental_readRawConfig as readRawWranglerConfig } from 'wrangler';
import { describe, expect, it } from 'vitest';
import { DeployEnvironment } from '../../src/operations/deploy-environment';

const ROOT_PACKAGE_PATH = '../../package.json';
const WRANGLER_CONFIG_PATH = 'wrangler.jsonc';
const DOCS_PREFLIGHT_COMMAND = 'node --env-file=.env --import tsx apps/api/scripts/docs-preflight.ts';
const TSX_VERSION = '4.23.15';
const SCRIPT_NAMES = [
  'deploy:staging',
  'deploy:production',
  'migrate:development',
  'migrate:staging',
  'migrate:production',
  'smoke:development',
  'smoke:staging',
  'smoke:production',
];
const ENVIRONMENT_FLAG_PATTERN = /--environment (\w+)/;
const MIGRATE_DATABASE_PATTERN = /migrations apply (\S+)/;

type RootPackage = { scripts: Record<string, string>; devDependencies: Record<string, string> };
type WranglerBlock = { d1_databases: { database_name: string }[] };
type WranglerFile = WranglerBlock & { env: Record<string, WranglerBlock> };

const rootPackage: RootPackage = JSON.parse(readFileSync(ROOT_PACKAGE_PATH, 'utf8'));
const wranglerFile = readRawWranglerConfig({ config: WRANGLER_CONFIG_PATH }).rawConfig as unknown as WranglerFile;

function databaseNameOf(input: { environment: string }): string {
  const block = input.environment === DeployEnvironment.Production ? wranglerFile : (wranglerFile.env[input.environment] as WranglerBlock);
  return (block.d1_databases[0] as { database_name: string }).database_name;
}

describe('root scripts', () => {
  it('declares docs:preflight, which loads the owner environment file and runs the docs preflight script', () => {
    expect(rootPackage.scripts['docs:preflight']).toBe(DOCS_PREFLIGHT_COMMAND);
  });

  it('pin: declares the eight deploy, migrate and smoke scripts', () => {
    SCRIPT_NAMES.forEach((name) => expect(rootPackage.scripts).toHaveProperty(name));
  });

  it.each(SCRIPT_NAMES.filter((name) => !name.startsWith('migrate')))('pin: %s passes the environment of its suffix', (name) => {
    const suffix = name.split(':')[1];
    expect(rootPackage.scripts[name]?.match(ENVIRONMENT_FLAG_PATTERN)?.[1]).toBe(suffix);
  });

  it.each(SCRIPT_NAMES.filter((name) => name.startsWith('migrate')))('pin: %s migrates the database of its block', (name) => {
    const environment = name.split(':')[1] as string;
    expect(rootPackage.scripts[name]?.match(MIGRATE_DATABASE_PATTERN)?.[1]).toBe(databaseNameOf({ environment }));
  });

  it('pin: pins the tsx loader the scripts run with', () => {
    expect(rootPackage.devDependencies.tsx).toBe(TSX_VERSION);
  });
});
