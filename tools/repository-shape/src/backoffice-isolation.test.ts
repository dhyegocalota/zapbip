import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const SOURCE_PATHSPECS = ['apps/*.ts', 'apps/*.tsx', 'libs/*.ts', 'libs/*.tsx'];
const AGENT_FACING_DIRECTORIES = ['apps/api/src/mcp/', 'apps/api/src/routes/', 'apps/api/src/account-inbox/', 'apps/connector/', 'libs/'];
const BACKOFFICE_IMPORT_PATTERN = /from '[^']*\/backoffice(\/[^']*)?'/;
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
