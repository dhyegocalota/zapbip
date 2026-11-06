import { readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const CLIENTS_DIRECTORY = 'scripts/e2e/clients';
const HERMES_CLIENT = `${CLIENTS_DIRECTORY}/hermes-client.ts`;
const ALL_INTERFACES_ADDRESS = '0.0.0.0';
const DIGEST_PINNED_IMAGE_PATTERN = /HERMES_IMAGE = '[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}'/;
const TYPESCRIPT_EXTENSION = '.ts';

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
});
