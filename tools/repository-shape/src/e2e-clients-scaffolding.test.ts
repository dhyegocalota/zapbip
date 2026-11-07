import { readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { bridgeGatewayHostOf } from '../../../scripts/e2e/clients/container-host';
import { readRepositoryFile, repositoryPath } from './repository-files';

const CLIENTS_DIRECTORY = 'scripts/e2e/clients';
const HERMES_CLIENT = `${CLIENTS_DIRECTORY}/hermes-client.ts`;
const ALL_INTERFACES_ADDRESS = '0.0.0.0';
const DIGEST_PINNED_IMAGE_PATTERN = /HERMES_IMAGE = '[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}'/;
const TYPESCRIPT_EXTENSION = '.ts';
const OPENCLAW_DOCKERFILE = `${CLIENTS_DIRECTORY}/openclaw/Dockerfile`;
const DOCKERFILE_DIGEST_PATTERN = /^FROM [\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/m;
const ROOT_MANIFEST = 'package.json';
const OPENCLAW_PACKAGE = 'openclaw';

function scaffoldingFiles(): string[] {
  return readdirSync(repositoryPath(CLIENTS_DIRECTORY))
    .filter((name) => name.endsWith(TYPESCRIPT_EXTENSION))
    .map((name) => `${CLIENTS_DIRECTORY}/${name}`);
}

describe('the client end-to-end scaffolding', () => {
  test.each(scaffoldingFiles())('%s never binds to all interfaces', (file) => {
    expect(readRepositoryFile(file)).not.toContain(ALL_INTERFACES_ADDRESS);
  });

  test('the Hermes image is pinned by digest', () => {
    expect(readRepositoryFile(HERMES_CLIENT)).toMatch(DIGEST_PINNED_IMAGE_PATTERN);
  });

  test('the OpenClaw base image is pinned by digest', () => {
    expect(readRepositoryFile(OPENCLAW_DOCKERFILE)).toMatch(DOCKERFILE_DIGEST_PATTERN);
  });

  test('the root manifest builds only the allowed dependencies and never openclaw', () => {
    const { pnpm } = JSON.parse(readRepositoryFile(ROOT_MANIFEST)) as { pnpm: Record<string, string[] | undefined> };
    expect(pnpm.onlyBuiltDependencies).toBeDefined();
    expect(pnpm.onlyBuiltDependencies).not.toContain(OPENCLAW_PACKAGE);
    expect(pnpm.neverBuiltDependencies).toBeUndefined();
  });

  test('the bridge gateway host is an IPv4 address', () => {
    expect(bridgeGatewayHostOf({ output: '172.17.0.1\n' })).toBe('172.17.0.1');
  });

  test.each(['', '\n', '::', 'not-an-address'])('the bridge gateway host %j is refused', (output) => {
    expect(() => bridgeGatewayHostOf({ output })).toThrow(/IPv4/);
  });
});
