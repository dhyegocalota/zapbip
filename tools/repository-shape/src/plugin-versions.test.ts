import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const SHARED_CONSTANTS = 'libs/types/src/constants.ts';
const OPENCLAW_MANIFEST = 'apps/openclaw-plugin/package.json';
const OPENCLAW_CONSTANTS = 'apps/openclaw-plugin/src/constants.ts';
const MISSING_DEPENDENCIES_MESSAGE = 'the Hermes project declares no dependencies line';
const HERMES_PROJECT = 'apps/hermes-plugin/pyproject.toml';
const HERMES_CONSTANTS = 'apps/hermes-plugin/zapbip_platform/constants.py';
const HERMES_MANIFEST = 'apps/hermes-plugin/zapbip_platform/plugin.yaml';
const HERMES_RUNTIME_LOCK = 'apps/hermes-plugin/requirements.txt';
const HERMES_DEVELOPMENT_LOCK = 'apps/hermes-plugin/requirements-dev.txt';
const REQUIRE_HASHES_INSTALL = '--require-hashes -r';
const WORKFLOW_FILE = '.github/workflows/verify.yml';
const PIP_INSTALL_PATTERN = /^\s*- run: python3 -m pip install (.+)$/gm;
const BOUNDED_DEPENDENCY_PATTERN = /^[\w.-]+>=[\d.]+,<[\d.]+$/;
const QUOTED_ENTRY_PATTERN = /"([^"]+)"/g;
const REQUIREMENT_LINE_PATTERN = /^[A-Za-z][\w.-]*==/;
const HASH_FLAG = '--hash=sha256:';

const sharedVersion = /export const ZAPBIP_NPM_VERSION = '([^']+)'/.exec(readRepositoryFile(SHARED_CONSTANTS))?.[1];
const openclawManifest = JSON.parse(readRepositoryFile(OPENCLAW_MANIFEST));

function versionOf({ path, pattern }: { path: string; pattern: RegExp }): string | undefined {
  return pattern.exec(readRepositoryFile(path))?.[1];
}

describe('the plugin versions', () => {
  test.each(Object.entries(AGENT_PLUGINS))('the %s plugin declares the shared version and every file it pins', (_id, plugin) => {
    expect(plugin.version).toBe(sharedVersion);
    plugin.versionPins.forEach((pin) => expect(readRepositoryFile(pin.path)).toMatch(pin.pattern));
  });

  test('the OpenClaw package declares the shared version', () => {
    expect(openclawManifest.version).toBe(sharedVersion);
  });

  test('the OpenClaw client names the shared version constant', () => {
    expect(versionOf({ path: OPENCLAW_CONSTANTS, pattern: /MCP_CLIENT_VERSION = (\w+)/ })).toBe('ZAPBIP_NPM_VERSION');
  });

  test('the OpenClaw package is publishable and ships only its build and manifest', () => {
    expect(openclawManifest.private).toBeUndefined();
    expect(openclawManifest.files).toEqual(['dist', 'openclaw.plugin.json']);
  });

  test('the OpenClaw package declares its entrypoint, channel and compatibility', () => {
    const { extensions, channel, compat } = openclawManifest.openclaw;
    expect(extensions).toEqual(['./dist/index.js']);
    expect(channel.id).toBe('zapbip');
    expect(compat.pluginApi).toMatch(/^>=/);
  });

  test('the Hermes project declares the shared version', () => {
    expect(versionOf({ path: HERMES_PROJECT, pattern: /^version = "([^"]+)"/m })).toBe(sharedVersion);
  });

  test('the Hermes constants and plugin manifest declare the shared version', () => {
    expect(versionOf({ path: HERMES_CONSTANTS, pattern: /PLUGIN_VERSION = "([^"]+)"/ })).toBe(sharedVersion);
    expect(versionOf({ path: HERMES_MANIFEST, pattern: /^version: (\S+)/m })).toBe(sharedVersion);
  });

  test('the Hermes project is installable with bounded runtime dependency ranges and the plugin entry point', () => {
    const project = readRepositoryFile(HERMES_PROJECT);
    const dependencies = /^dependencies = \[(.*)\]$/m.exec(project)?.[1];
    if (dependencies === undefined) throw new Error(MISSING_DEPENDENCIES_MESSAGE);
    expect(project).toContain('[build-system]');
    expect(project).toContain('[project.entry-points."hermes_agent.plugins"]');
    const entries = [...dependencies.matchAll(QUOTED_ENTRY_PATTERN)].map((match) => match[1] as string);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => BOUNDED_DEPENDENCY_PATTERN.test(entry))).toBe(true);
  });

  test.each([HERMES_RUNTIME_LOCK, HERMES_DEVELOPMENT_LOCK])('%s pins every requirement with a hash', (lockFile) => {
    const requirementBlocks = readRepositoryFile(lockFile)
      .split('\n')
      .filter((line) => REQUIREMENT_LINE_PATTERN.test(line));
    expect(requirementBlocks.length).toBeGreaterThan(0);
    const text = readRepositoryFile(lockFile);
    expect(text.split(HASH_FLAG).length - 1).toBeGreaterThanOrEqual(requirementBlocks.length);
    expect(text).not.toMatch(/^[A-Za-z][\w.-]*==[^\\\n]*$/m);
  });

  test('the workflow installs the Python requirements only with --require-hashes from the hashed development lock', () => {
    const installs = [...readRepositoryFile(WORKFLOW_FILE).matchAll(PIP_INSTALL_PATTERN)].map((match) => match[1]);
    expect(installs.length).toBeGreaterThan(0);
    const pythonRequirements = Object.values(AGENT_PLUGINS).flatMap((plugin) =>
      plugin.workflow.pythonRequirements === null ? [] : [plugin.workflow.pythonRequirements],
    );
    const allowedInstalls = pythonRequirements.map((path) => `${REQUIRE_HASHES_INSTALL} ${path}`);
    expect(installs.every((install) => install !== undefined && allowedInstalls.includes(install))).toBe(true);
    expect(pythonRequirements).toContain(HERMES_DEVELOPMENT_LOCK);
  });
});
