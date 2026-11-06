import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, test } from 'vitest';

const runCommand = promisify(execFile);
const PRODUCTION_BUNDLE_FILE = 'index.js';
const DEVELOPMENT_BUNDLE_FILE = 'index.dev.js';
const BUNDLE_TIMEOUT_MS = 120_000;
const WAKE_DEV_MARKERS = [
  'devScriptWake',
  'devReadWakeRequests',
  'devRunDueWakes',
  'ScriptedWakeTransport',
  'wake/script',
  'wake/requests',
  '/wake/run`',
];
const DEVELOPMENT_ENVIRONMENT_ARGUMENTS = ['--env', 'development'];

const outputDirectories: string[] = [];

async function bundleOf(input: { extraArguments: string[]; bundleFile: string }): Promise<string> {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'zapbip-wake-bundle-'));
  outputDirectories.push(outputDirectory);
  await runCommand('pnpm', ['exec', 'wrangler', 'deploy', '--dry-run', ...input.extraArguments, '--outdir', outputDirectory]);
  return readFile(join(outputDirectory, input.bundleFile), 'utf8');
}

afterAll(async () => {
  await Promise.all(outputDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('wake production bundle', () => {
  test(
    'WB-1 the production bundle carries no wake development surface',
    async () => {
      const bundle = await bundleOf({ extraArguments: [], bundleFile: PRODUCTION_BUNDLE_FILE });
      expect(WAKE_DEV_MARKERS.filter((marker) => bundle.includes(marker))).toEqual([]);
    },
    BUNDLE_TIMEOUT_MS,
  );

  test(
    'WB-2 the development bundle carries the whole wake development surface',
    async () => {
      const bundle = await bundleOf({ extraArguments: DEVELOPMENT_ENVIRONMENT_ARGUMENTS, bundleFile: DEVELOPMENT_BUNDLE_FILE });
      expect(WAKE_DEV_MARKERS.filter((marker) => !bundle.includes(marker))).toEqual([]);
    },
    BUNDLE_TIMEOUT_MS,
  );
});
