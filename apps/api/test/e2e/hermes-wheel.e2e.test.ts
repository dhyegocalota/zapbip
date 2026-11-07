import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { hermesWheelPath, ZAPBIP_HERMES_PLUGIN_VERSION, ZAPBIP_HERMES_WHEEL_SHA256 } from '@zapbip/types';
import { afterAll, describe, expect, test } from 'vitest';
import { stack } from './stack';

const runCommand = promisify(execFile);
const PYTHON = 'python3';
const NOT_UPLOADED_VERSION = '9.9.9';
const HASH_MISMATCH_MESSAGE = 'DO NOT MATCH THE HASHES';
const NOT_FOUND_MESSAGE = '404';
const WRONG_LAST_DIGIT = '0';
const PACKAGE_DIRECTORY_NAME = 'zapbip_platform';
const INIT_FILE = '__init__.py';

type PipOutcome = { exitCode: number; output: string };

const targetDirectories: string[] = [];

async function pipInstall(input: { version: string; sha256: string }): Promise<PipOutcome & { target: string }> {
  const target = await mkdtemp(join(tmpdir(), 'zapbip-pip-'));
  targetDirectories.push(target);
  const requirement = `zapbip-platform @ ${stack().origin}${hermesWheelPath({ version: input.version })}#sha256=${input.sha256}`;
  const args = ['-m', 'pip', 'install', '--no-deps', '--no-cache-dir', '--disable-pip-version-check', '--target', target, requirement];
  const outcome = await runCommand(PYTHON, args).then(
    ({ stdout, stderr }) => ({ exitCode: 0, output: `${stdout}${stderr}` }),
    (failure: { code: number; stdout: string; stderr: string }) => ({
      exitCode: failure.code,
      output: `${failure.stdout}${failure.stderr}`,
    }),
  );
  return { ...outcome, target };
}

afterAll(async () => {
  await Promise.all(targetDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('pip installs the hosted Hermes wheel', () => {
  test('the pinned direct reference installs the plugin from the local Worker', async () => {
    const { exitCode, target } = await pipInstall({ version: ZAPBIP_HERMES_PLUGIN_VERSION, sha256: ZAPBIP_HERMES_WHEEL_SHA256 });
    expect(exitCode).toBe(0);
    expect(existsSync(join(target, PACKAGE_DIRECTORY_NAME, INIT_FILE))).toBe(true);
  });

  test('a wrong hash is refused by pip', async () => {
    const wrongHash = `${ZAPBIP_HERMES_WHEEL_SHA256.slice(0, -1)}${WRONG_LAST_DIGIT}`;
    const { exitCode, output } = await pipInstall({ version: ZAPBIP_HERMES_PLUGIN_VERSION, sha256: wrongHash });
    expect(exitCode).not.toBe(0);
    expect(output.toUpperCase()).toContain(HASH_MISMATCH_MESSAGE);
  });

  test('a wheel that was never uploaded answers 404', async () => {
    const { exitCode, output } = await pipInstall({ version: NOT_UPLOADED_VERSION, sha256: ZAPBIP_HERMES_WHEEL_SHA256 });
    expect(exitCode).not.toBe(0);
    expect(output).toContain(NOT_FOUND_MESSAGE);
  });
});
