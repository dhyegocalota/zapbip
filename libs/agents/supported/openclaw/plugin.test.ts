import { ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { readSource } from '../../generate/source';

const OPENCLAW_MANIFEST = 'apps/openclaw-plugin/package.json';
const OPENCLAW_CONSTANTS = 'apps/openclaw-plugin/src/constants.ts';
const ROOT_MANIFEST = 'package.json';
const OPENCLAW_PACKAGE = 'openclaw';
const OPENCLAW_DOCKERFILE = 'apps/openclaw-plugin/e2e/openclaw/Dockerfile';
const DOCKERFILE_DIGEST_PATTERN = /^FROM [\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/m;

const manifest = JSON.parse(readSource(OPENCLAW_MANIFEST));

describe('the OpenClaw plugin package', () => {
  test('declares the shared version', () => {
    expect(manifest.version).toBe(ZAPBIP_NPM_VERSION);
  });

  test('names the shared version constant in its client', () => {
    expect(/MCP_CLIENT_VERSION = (\w+)/.exec(readSource(OPENCLAW_CONSTANTS))?.[1]).toBe('ZAPBIP_NPM_VERSION');
  });

  test('is publishable and ships only its build and manifest', () => {
    expect(manifest.private).toBeUndefined();
    expect(manifest.files).toEqual(['dist', 'openclaw.plugin.json']);
  });

  test('declares its entrypoint, channel and compatibility', () => {
    const { extensions, channel, compat } = manifest.openclaw;
    expect(extensions).toEqual(['./dist/index.js']);
    expect(channel.id).toBe('zapbip');
    expect(compat.pluginApi).toMatch(/^>=/);
  });

  test('has its end-to-end base image pinned by digest', () => {
    expect(readSource(OPENCLAW_DOCKERFILE)).toMatch(DOCKERFILE_DIGEST_PATTERN);
  });

  test('is never built by the root manifest', () => {
    const { pnpm } = JSON.parse(readSource(ROOT_MANIFEST)) as { pnpm: Record<string, string[] | undefined> };
    expect(pnpm.onlyBuiltDependencies).not.toContain(OPENCLAW_PACKAGE);
  });
});
