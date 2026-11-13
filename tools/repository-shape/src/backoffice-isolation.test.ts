import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const SOURCE_PATHSPECS = ['apps/*.ts', 'apps/*.tsx', 'libs/*.ts', 'libs/*.tsx'];
const AGENT_FACING_DIRECTORIES = ['apps/api/src/mcp/', 'apps/api/src/routes/', 'apps/api/src/account-inbox/', 'apps/connector/', 'libs/'];
const BACKOFFICE_IMPORT_PATTERN = /from '[^']*\/backoffice(\/[^']*)?'/;
const SITE_IMPORT_PATTERN = /from '[^']*\/site(\/[^']*)?'/;
const CLIENT_APP_IMPORT_PATTERN = /from '[^']*\/client-app(\/[^']*)?'/;
const BACKOFFICE_TABLE_PATTERN = /\bbackoffice_(operator|sessions|audit)\b/;
const SEALED_COLUMN_PATTERN = /\bsealed_(app_secret|access_token)\b/;
const TEST_PATH_PATTERN = /(^|\/)(test|e2e)\//;
const BACKOFFICE_TABLE_OWNERS = ['apps/api/src/backoffice/', 'apps/api/scripts/backoffice-enroll.ts'];
const SEALED_COLUMN_OWNERS = [
  'apps/api/src/numbers/',
  'apps/api/src/backoffice/numbers/',
  'apps/api/src/adapters/d1/d1-number-registry.ts',
  'apps/api/src/adapters/d1/d1-number-admin.ts',
  'apps/api/src/dev/development-number-seed.ts',
];

function productionSources(): string[] {
  return SOURCE_PATHSPECS.flatMap(repositoryFiles).filter((path) => !TEST_PATH_PATTERN.test(path));
}

function isUnder({ path, owners }: { path: string; owners: string[] }): boolean {
  return owners.some((owner) => path.startsWith(owner));
}

function filesMatching({ paths, pattern }: { paths: string[]; pattern: RegExp }): string[] {
  return paths.filter((path) => pattern.test(readRepositoryFile(path)));
}

describe('backoffice isolation', () => {
  test('no agent-facing code imports the backoffice', () => {
    const agentFacing = productionSources().filter((path) => isUnder({ path, owners: AGENT_FACING_DIRECTORIES }));
    expect(filesMatching({ paths: agentFacing, pattern: BACKOFFICE_IMPORT_PATTERN })).toEqual([]);
  });

  test('no agent-facing code imports the public site', () => {
    const agentFacing = productionSources().filter((path) => isUnder({ path, owners: AGENT_FACING_DIRECTORIES }));
    expect(filesMatching({ paths: agentFacing, pattern: SITE_IMPORT_PATTERN })).toEqual([]);
  });

  test('no agent-facing code imports the customer web app', () => {
    const agentFacing = productionSources().filter((path) => isUnder({ path, owners: AGENT_FACING_DIRECTORIES }));
    expect(filesMatching({ paths: agentFacing, pattern: CLIENT_APP_IMPORT_PATTERN })).toEqual([]);
  });

  test('the import pattern catches a customer web app import and ignores a lookalike', () => {
    expect(CLIENT_APP_IMPORT_PATTERN.test("import { x } from '../client-app/client-app';")).toBe(true);
    expect(CLIENT_APP_IMPORT_PATTERN.test("import { x } from '../client-apps/app';")).toBe(false);
  });

  test('the public site names no backoffice table and no sealed column', () => {
    const siteSources = productionSources().filter((path) => path.startsWith('apps/api/src/site/'));
    expect(siteSources.length).toBeGreaterThan(0);
    expect(filesMatching({ paths: siteSources, pattern: BACKOFFICE_TABLE_PATTERN })).toEqual([]);
    expect(filesMatching({ paths: siteSources, pattern: SEALED_COLUMN_PATTERN })).toEqual([]);
  });

  test('the import pattern catches a site import and ignores a lookalike', () => {
    expect(SITE_IMPORT_PATTERN.test("import { x } from '../site/site-app';")).toBe(true);
    expect(SITE_IMPORT_PATTERN.test("import { x } from '../website/app';")).toBe(false);
  });

  test('no backoffice table is named outside the backoffice and its enrollment script', () => {
    const outside = productionSources().filter((path) => !isUnder({ path, owners: BACKOFFICE_TABLE_OWNERS }));
    expect(filesMatching({ paths: outside, pattern: BACKOFFICE_TABLE_PATTERN })).toEqual([]);
  });

  test('sealed registry columns are named only by the registry code', () => {
    const outside = productionSources().filter((path) => !isUnder({ path, owners: SEALED_COLUMN_OWNERS }));
    expect(filesMatching({ paths: outside, pattern: SEALED_COLUMN_PATTERN })).toEqual([]);
  });

  test('the scanned sources are not empty', () => {
    expect(productionSources().length).toBeGreaterThan(0);
  });

  test('the import pattern catches a backoffice import and ignores a lookalike', () => {
    expect(BACKOFFICE_IMPORT_PATTERN.test("import { x } from '../backoffice/app';")).toBe(true);
    expect(BACKOFFICE_IMPORT_PATTERN.test("import { x } from '../backoffice-like/app';")).toBe(false);
  });
});
