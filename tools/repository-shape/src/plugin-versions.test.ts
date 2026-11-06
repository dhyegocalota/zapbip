import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const SHARED_CONSTANTS = 'libs/types/src/constants.ts';
const OPENCLAW_MANIFEST = 'apps/openclaw-plugin/package.json';
const OPENCLAW_CONSTANTS = 'apps/openclaw-plugin/src/constants.ts';
const HERMES_PROJECT = 'apps/hermes-plugin/pyproject.toml';
const HERMES_CONSTANTS = 'apps/hermes-plugin/zapbip_platform/constants.py';
const HERMES_MANIFEST = 'apps/hermes-plugin/zapbip_platform/plugin.yaml';

const sharedVersion = /export const ZAPBIP_NPM_VERSION = '([^']+)'/.exec(readRepositoryFile(SHARED_CONSTANTS))?.[1];
const openclawManifest = JSON.parse(readRepositoryFile(OPENCLAW_MANIFEST));

function versionOf({ path, pattern }: { path: string; pattern: RegExp }): string | undefined {
  return pattern.exec(readRepositoryFile(path))?.[1];
}

describe('the plugin versions', () => {
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
});
