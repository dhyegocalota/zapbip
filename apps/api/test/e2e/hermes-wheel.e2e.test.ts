import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { HERMES_INSTALL_COMMAND } from '@zapbip/agents/plugins';
import { PRODUCTION_PUBLIC_ORIGIN } from '@zapbip/types';
import { afterAll, describe, expect, test } from 'vitest';
import {
  hermesRequirementsPath,
  hermesWheelPath,
  ZAPBIP_HERMES_PLUGIN_VERSION,
  ZAPBIP_HERMES_REQUIREMENTS_SHA256,
  ZAPBIP_HERMES_WHEEL_SHA256,
} from '../../../../libs/agents/supported/hermes/wheel';
import { stack } from './stack';

const runCommand = promisify(execFile);
const PYTHON = 'python3';
const NOT_UPLOADED_VERSION = '9.9.9';
const HASH_MISMATCH_MESSAGE = 'DO NOT MATCH THE HASHES';
const NOT_FOUND_MESSAGE = '404';
const WRONG_LAST_DIGIT = '0';
const PACKAGE_DIRECTORY_NAME = 'zapbip_platform';
const INIT_FILE = '__init__.py';
const DEPENDENCY_PACKAGE_DIRECTORY = 'httpx';
const ZERO_HASH = '0'.repeat(64);
const PIP_TARGET_OPTIONS = '--no-cache-dir --disable-pip-version-check';
const SHELL = 'sh';

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

type CommandOutcome = { exitCode: number; output: string };

async function runShell(input: { command: string; directory: string }): Promise<CommandOutcome> {
  return runCommand(SHELL, ['-c', input.command], { cwd: input.directory }).then(
    ({ stdout, stderr }) => ({ exitCode: 0, output: `${stdout}${stderr}` }),
    (failure: { code: number; stdout: string; stderr: string }) => ({
      exitCode: failure.code,
      output: `${failure.stdout}${failure.stderr}`,
    }),
  );
}

async function servedRequirements(): Promise<string> {
  const response = await fetch(`${stack().origin}${hermesRequirementsPath({ version: ZAPBIP_HERMES_PLUGIN_VERSION })}`);
  return response.text();
}

function sha256Of(input: { text: string }): string {
  return createHash('sha256').update(input.text).digest('hex');
}

function localInstallCommand(input: { requirementsSha256: string; target: string }): string {
  return `${HERMES_INSTALL_COMMAND.replaceAll(PRODUCTION_PUBLIC_ORIGIN, stack().origin).replace(ZAPBIP_HERMES_REQUIREMENTS_SHA256, input.requirementsSha256)} --target ${input.target} ${PIP_TARGET_OPTIONS}`;
}

async function newDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'zapbip-install-'));
  targetDirectories.push(directory);
  return directory;
}

describe('the printed install command', () => {
  test('downloads the requirements file, checks its hash and installs the plugin with its pinned dependencies', async () => {
    const [directory, target] = [await newDirectory(), await newDirectory()];
    const requirementsSha256 = sha256Of({ text: await servedRequirements() });
    const outcome = await runShell({ command: localInstallCommand({ requirementsSha256, target }), directory });
    expect(outcome.exitCode).toBe(0);
    expect(existsSync(join(target, PACKAGE_DIRECTORY_NAME, INIT_FILE))).toBe(true);
    expect(existsSync(join(target, DEPENDENCY_PACKAGE_DIRECTORY))).toBe(true);
  });

  test('a tampered requirements file stops at the hash check and installs nothing', async () => {
    const [directory, target] = [await newDirectory(), await newDirectory()];
    const expectedSha256 = sha256Of({ text: await servedRequirements() });
    const tamperedSha256 = `${expectedSha256.slice(0, -1)}${expectedSha256.endsWith(WRONG_LAST_DIGIT) ? '1' : WRONG_LAST_DIGIT}`;
    const outcome = await runShell({ command: localInstallCommand({ requirementsSha256: tamperedSha256, target }), directory });
    expect(outcome.exitCode).not.toBe(0);
    expect(existsSync(join(target, PACKAGE_DIRECTORY_NAME))).toBe(false);
  });

  test('a tampered dependency hash is refused by pip under --require-hashes', async () => {
    const [directory, target] = [await newDirectory(), await newDirectory()];
    const tampered = (await servedRequirements()).replace(/^(httpx==[^\n]*\n(?: {4}--hash=sha256:[0-9a-f]{64}[^\n]*\n)+)/m, (block) =>
      block.replace(/[0-9a-f]{64}/g, ZERO_HASH),
    );
    await writeFile(join(directory, 'tampered-requirements.txt'), tampered);
    const command = `python3 -m pip install --require-hashes -r tampered-requirements.txt --target ${target} ${PIP_TARGET_OPTIONS}`;
    const outcome = await runShell({ command, directory });
    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.output.toUpperCase()).toContain(HASH_MISMATCH_MESSAGE);
  });
});
