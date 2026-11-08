import { readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { bridgeGatewayHostOf } from '../../../scripts/e2e/clients/container-host';
import { readRepositoryFile, repositoryPath } from './repository-files';

const CLIENTS_DIRECTORY = 'scripts/e2e/clients';
const ALL_INTERFACES_ADDRESS = '0.0.0.0';
const TYPESCRIPT_EXTENSION = '.ts';
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
