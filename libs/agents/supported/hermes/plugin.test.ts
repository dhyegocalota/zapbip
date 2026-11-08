import { ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { readSource } from '../../generate/source';

const MISSING_DEPENDENCIES_MESSAGE = 'the Hermes project declares no dependencies line';
const HERMES_PROJECT = 'apps/hermes-plugin/pyproject.toml';
const HERMES_CONSTANTS = 'apps/hermes-plugin/zapbip_platform/constants.py';
const HERMES_MANIFEST = 'apps/hermes-plugin/zapbip_platform/plugin.yaml';
const HERMES_RUNTIME_LOCK = 'apps/hermes-plugin/requirements.txt';
const HERMES_DEVELOPMENT_LOCK = 'apps/hermes-plugin/requirements-dev.txt';
const HERMES_CLIENT = 'apps/hermes-plugin/e2e/hermes-client.ts';
const HERMES_BUILD_REQUIREMENTS = 'apps/hermes-plugin/e2e/hermes/build-requirements.txt';
const HERMES_DOCKERFILE = 'apps/hermes-plugin/e2e/hermes/Dockerfile';
const PLUGIN_WHEEL_BUILD_SCRIPT = 'scripts/plugin-wheel/build.ts';
const BOUNDED_DEPENDENCY_PATTERN = /^[\w.-]+>=[\d.]+,<[\d.]+$/;
const QUOTED_ENTRY_PATTERN = /"([^"]+)"/g;
const REQUIREMENT_LINE_PATTERN = /^[A-Za-z][\w.-]*==/;
const HASH_FLAG = '--hash=sha256:';
const DIGEST_PINNED_IMAGE_PATTERN = /HERMES_IMAGE = '[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}'/;

function versionOf({ path, pattern }: { path: string; pattern: RegExp }): string | undefined {
  return pattern.exec(readSource(path))?.[1];
}

describe('the Hermes plugin package', () => {
  test('the project declares the shared version', () => {
    expect(versionOf({ path: HERMES_PROJECT, pattern: /^version = "([^"]+)"/m })).toBe(ZAPBIP_NPM_VERSION);
  });

  test('the constants and plugin manifest declare the shared version', () => {
    expect(versionOf({ path: HERMES_CONSTANTS, pattern: /PLUGIN_VERSION = "([^"]+)"/ })).toBe(ZAPBIP_NPM_VERSION);
    expect(versionOf({ path: HERMES_MANIFEST, pattern: /^version: (\S+)/m })).toBe(ZAPBIP_NPM_VERSION);
  });

  test('the project is installable with bounded runtime dependency ranges and the plugin entry point', () => {
    const project = readSource(HERMES_PROJECT);
    const dependencies = /^dependencies = \[(.*)\]$/m.exec(project)?.[1];
    if (dependencies === undefined) throw new Error(MISSING_DEPENDENCIES_MESSAGE);
    expect(project).toContain('[build-system]');
    expect(project).toContain('[project.entry-points."hermes_agent.plugins"]');
    const entries = [...dependencies.matchAll(QUOTED_ENTRY_PATTERN)].map((match) => match[1] as string);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => BOUNDED_DEPENDENCY_PATTERN.test(entry))).toBe(true);
  });

  test.each([HERMES_RUNTIME_LOCK, HERMES_DEVELOPMENT_LOCK])('%s pins every requirement with a hash', (lockFile) => {
    const text = readSource(lockFile);
    const requirementBlocks = text.split('\n').filter((line) => REQUIREMENT_LINE_PATTERN.test(line));
    expect(requirementBlocks.length).toBeGreaterThan(0);
    expect(text.split(HASH_FLAG).length - 1).toBeGreaterThanOrEqual(requirementBlocks.length);
    expect(text).not.toMatch(/^[A-Za-z][\w.-]*==[^\\\n]*$/m);
  });

  test('the end-to-end image is pinned by digest', () => {
    expect(readSource(HERMES_CLIENT)).toMatch(DIGEST_PINNED_IMAGE_PATTERN);
  });

  test('the wheel is built without isolation from a hashed build requirement', () => {
    expect(readSource(PLUGIN_WHEEL_BUILD_SCRIPT)).toContain('--no-build-isolation');
    expect(readSource(HERMES_BUILD_REQUIREMENTS)).toMatch(/^setuptools==[\d.]+ \\\n\s+--hash=sha256:[0-9a-f]{64}$/m);
  });

  test('the end-to-end image installs the committed wheel by its sha256 pin and builds nothing', () => {
    expect(readSource(HERMES_DOCKERFILE)).toContain('#sha256=');
    expect(readSource(HERMES_CLIENT)).not.toContain('pip wheel');
    expect(readSource(HERMES_CLIENT)).not.toContain('build-requirements');
  });
});
