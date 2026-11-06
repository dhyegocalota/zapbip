import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, test } from 'vitest';
import { DEVELOPMENT_ENVIRONMENT } from '../../src/contract/constants';

const runCommand = promisify(execFile);
const PRODUCTION_BUNDLE_FILE = 'index.js';
const DEVELOPMENT_BUNDLE_FILE = 'index.dev.js';
const BUNDLE_TIMEOUT_MS = 120_000;
const DEV_OWNER_ROUTE_PREFIX = '/dev/owner/';
const SIMULATOR_IDENTIFIER = 'owner-simulator';
const DEV_METHODS = ['advanceClock', 'readScreen'];
const DEVELOPMENT_ENVIRONMENT_ARGUMENTS = ['--env', DEVELOPMENT_ENVIRONMENT];
const STAGING_ENVIRONMENT_ARGUMENTS = ['--env', 'staging'];

const outputDirectories: string[] = [];

async function bundleOf(input: { extraArguments: string[]; bundleFile: string }): Promise<string> {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'zapbip-bundle-'));
  outputDirectories.push(outputDirectory);
  await runCommand('pnpm', ['exec', 'wrangler', 'deploy', '--dry-run', ...input.extraArguments, '--outdir', outputDirectory]);
  return readFile(join(outputDirectory, input.bundleFile), 'utf8');
}

afterAll(async () => {
  await Promise.all(outputDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('production bundle', () => {
  test(
    'PB-1 PB-2 the top-level block is the production bundle and carries no development surface',
    async () => {
      const bundle = await bundleOf({ extraArguments: [], bundleFile: PRODUCTION_BUNDLE_FILE });
      const present = [DEV_OWNER_ROUTE_PREFIX, SIMULATOR_IDENTIFIER, ...DEV_METHODS].filter((marker) => bundle.includes(marker));
      expect(present).toEqual([]);
    },
    BUNDLE_TIMEOUT_MS,
  );

  test(
    'PB-4 the staging block bundles without the development surface',
    async () => {
      const bundle = await bundleOf({ extraArguments: STAGING_ENVIRONMENT_ARGUMENTS, bundleFile: PRODUCTION_BUNDLE_FILE });
      const present = [DEV_OWNER_ROUTE_PREFIX, SIMULATOR_IDENTIFIER, ...DEV_METHODS].filter((marker) => bundle.includes(marker));
      expect(present).toEqual([]);
    },
    BUNDLE_TIMEOUT_MS,
  );

  test(
    'PB-3 the development bundle carries the development surface',
    async () => {
      const bundle = await bundleOf({ extraArguments: DEVELOPMENT_ENVIRONMENT_ARGUMENTS, bundleFile: DEVELOPMENT_BUNDLE_FILE });
      const missing = [DEV_OWNER_ROUTE_PREFIX, ...DEV_METHODS].filter((marker) => !bundle.includes(marker));
      expect(missing).toEqual([]);
    },
    BUNDLE_TIMEOUT_MS,
  );
});
