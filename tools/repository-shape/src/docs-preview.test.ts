import { describe, expect, test } from 'vitest';
import { DOCS_ROOT, PACKAGE_MANIFEST, readRepositoryFile } from './repository-files';

const PINNED_CLIENT_VERSION = /--client-version \d+\.\d+\.\d+(\s|$)/;
const scripts = JSON.parse(readRepositoryFile(`${DOCS_ROOT}/${PACKAGE_MANIFEST}`)).scripts as Record<string, string>;

describe('docs preview', () => {
  test('the dev script pins the Mintlify client, which is otherwise downloaded as latest on every start', () => {
    expect(scripts.dev).toMatch(PINNED_CLIENT_VERSION);
  });
});
