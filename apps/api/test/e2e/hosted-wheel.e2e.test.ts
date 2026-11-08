import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { AGENT_PLUGINS, PluginRegistry, type AgentPlugin, type HostedArtifact } from '@zapbip/agents/plugins';
import { PRODUCTION_PUBLIC_ORIGIN } from '@zapbip/types';
import { afterAll, describe, expect, test } from 'vitest';
import { stack } from './stack';

const runCommand = promisify(execFile);
const PYTHON = 'python3';
const NOT_UPLOADED_VERSION = '9.9.9';
const HASH_MISMATCH_MESSAGE = 'DO NOT MATCH THE HASHES';
const NOT_FOUND_MESSAGE = '404';
const WRONG_LAST_DIGIT = '0';
const INIT_FILE = '__init__.py';
const ZERO_HASH = '0'.repeat(64);
const PIP_TARGET_OPTIONS = '--no-cache-dir --disable-pip-version-check';
const SHELL = 'sh';
const PINNED_DEPENDENCY_PATTERN = /^([\w.-]+)==[^\n]*\n(?: {4}--hash=sha256:[0-9a-f]{64}[^\n]*\n)+/m;

type PipOutcome = { exitCode: number; output: string };
type WheelPlugin = { id: string; plugin: AgentPlugin; wheel: HostedArtifact; requirements: HostedArtifact; packageDirectory: string };

const targetDirectories: string[] = [];
const wheelPlugins: WheelPlugin[] = Object.entries(AGENT_PLUGINS)
  .filter(([, plugin]) => plugin.registry === PluginRegistry.SelfHostedWheel)
  .map(([id, plugin]) => ({
    id,
    plugin,
    wheel: plugin.hostedArtifacts.find((artifact) => !artifact.embeddedInInstallCommand) as HostedArtifact,
    requirements: plugin.hostedArtifacts.find((artifact) => artifact.embeddedInInstallCommand) as HostedArtifact,
    packageDirectory: plugin.packageName.replaceAll('-', '_'),
  }));

async function outcomeOf(input: { command: Promise<{ stdout: string; stderr: string }> }): Promise<PipOutcome> {
  return input.command.then(
    ({ stdout, stderr }) => ({ exitCode: 0, output: `${stdout}${stderr}` }),
    (failure: { code: number; stdout: string; stderr: string }) => ({
      exitCode: failure.code,
      output: `${failure.stdout}${failure.stderr}`,
    }),
  );
}

async function pipInstall(input: { subject: WheelPlugin; path: string; sha256: string }): Promise<PipOutcome & { target: string }> {
  const target = await mkdtemp(join(tmpdir(), 'zapbip-pip-'));
  targetDirectories.push(target);
  const requirement = `${input.subject.plugin.packageName} @ ${stack().origin}${input.path}#sha256=${input.sha256}`;
  const args = ['-m', 'pip', 'install', '--no-deps', '--no-cache-dir', '--disable-pip-version-check', '--target', target, requirement];
  return { ...(await outcomeOf({ command: runCommand(PYTHON, args) })), target };
}

async function runShell(input: { command: string; directory: string }): Promise<PipOutcome> {
  return outcomeOf({ command: runCommand(SHELL, ['-c', input.command], { cwd: input.directory }) });
}

async function servedRequirements(input: { subject: WheelPlugin }): Promise<string> {
  const response = await fetch(`${stack().origin}${input.subject.requirements.path}`);
  return response.text();
}

function sha256Of(input: { text: string }): string {
  return createHash('sha256').update(input.text).digest('hex');
}

function localInstallCommand(input: { subject: WheelPlugin; requirementsSha256: string; target: string }): string {
  const { plugin, requirements } = input.subject;
  const localCommand = plugin.installCommand
    .replaceAll(PRODUCTION_PUBLIC_ORIGIN, stack().origin)
    .replace(requirements.expectedSha256, input.requirementsSha256);
  return `${localCommand} --target ${input.target} ${PIP_TARGET_OPTIONS}`;
}

async function newDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'zapbip-install-'));
  targetDirectories.push(directory);
  return directory;
}

afterAll(async () => {
  await Promise.all(targetDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('the self-hosted wheel plugins', () => {
  test('are the plugins that host a wheel', () => {
    wheelPlugins.forEach((subject) => expect(subject.plugin.hostedArtifacts.length).toBeGreaterThan(0));
  });
});

describe.each(wheelPlugins)('pip installs the hosted wheel of the $id plugin', (subject) => {
  test('the pinned direct reference installs the plugin from the local Worker', async () => {
    const { exitCode, target } = await pipInstall({ subject, path: subject.wheel.path, sha256: subject.wheel.expectedSha256 });
    expect(exitCode).toBe(0);
    expect(existsSync(join(target, subject.packageDirectory, INIT_FILE))).toBe(true);
  });

  test('a wrong hash is refused by pip', async () => {
    const wrongHash = `${subject.wheel.expectedSha256.slice(0, -1)}${WRONG_LAST_DIGIT}`;
    const { exitCode, output } = await pipInstall({ subject, path: subject.wheel.path, sha256: wrongHash });
    expect(exitCode).not.toBe(0);
    expect(output.toUpperCase()).toContain(HASH_MISMATCH_MESSAGE);
  });

  test('a wheel that was never uploaded answers 404', async () => {
    const path = subject.wheel.path.replace(subject.plugin.version, NOT_UPLOADED_VERSION);
    const { exitCode, output } = await pipInstall({ subject, path, sha256: subject.wheel.expectedSha256 });
    expect(exitCode).not.toBe(0);
    expect(output).toContain(NOT_FOUND_MESSAGE);
  });
});

describe.each(wheelPlugins)('the printed install command of the $id plugin', (subject) => {
  test('downloads the requirements file, checks its hash and installs the plugin with its pinned dependencies', async () => {
    const [directory, target] = [await newDirectory(), await newDirectory()];
    const requirementsSha256 = sha256Of({ text: await servedRequirements({ subject }) });
    const outcome = await runShell({ command: localInstallCommand({ subject, requirementsSha256, target }), directory });
    const dependencyName = PINNED_DEPENDENCY_PATTERN.exec(await servedRequirements({ subject }))?.[1] as string;
    expect(outcome.exitCode).toBe(0);
    expect(existsSync(join(target, subject.packageDirectory, INIT_FILE))).toBe(true);
    expect(existsSync(join(target, dependencyName))).toBe(true);
  });

  test('a tampered requirements file stops at the hash check and installs nothing', async () => {
    const [directory, target] = [await newDirectory(), await newDirectory()];
    const expectedSha256 = sha256Of({ text: await servedRequirements({ subject }) });
    const tamperedSha256 = `${expectedSha256.slice(0, -1)}${expectedSha256.endsWith(WRONG_LAST_DIGIT) ? '1' : WRONG_LAST_DIGIT}`;
    const outcome = await runShell({ command: localInstallCommand({ subject, requirementsSha256: tamperedSha256, target }), directory });
    expect(outcome.exitCode).not.toBe(0);
    expect(existsSync(join(target, subject.packageDirectory))).toBe(false);
  });

  test('a tampered dependency hash is refused by pip under --require-hashes', async () => {
    const [directory, target] = [await newDirectory(), await newDirectory()];
    const tampered = (await servedRequirements({ subject })).replace(PINNED_DEPENDENCY_PATTERN, (block) =>
      block.replace(/[0-9a-f]{64}/g, ZERO_HASH),
    );
    await writeFile(join(directory, 'tampered-requirements.txt'), tampered);
    const command = `python3 -m pip install --require-hashes -r tampered-requirements.txt --target ${target} ${PIP_TARGET_OPTIONS}`;
    const outcome = await runShell({ command, directory });
    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.output.toUpperCase()).toContain(HASH_MISMATCH_MESSAGE);
  });
});
