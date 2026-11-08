import { describe, expect, test } from 'vitest';
import { readRepositoryFile, trackedFiles } from './repository-files';

const REMOVED_NAMES = ['ZAPBIP_PYPI_VERSION', 'ZAPBIP_PYPI_PUBLISHER', 'pypi.org'];
const RECORD_DIRECTORIES = ['docs/adr/', 'docs/learnings/', 'docs/features/'];
const THIS_TEST = 'tools/repository-shape/src/removed-package-index.test.ts';
const BINARY_EXTENSION = '.whl';

describe('the removed package index', () => {
  test('no file outside the records names the removed PyPI constants or hosts', () => {
    const namingRemoved = trackedFiles()
      .filter((path) => path !== THIS_TEST)
      .filter((path) => !RECORD_DIRECTORIES.some((directory) => path.startsWith(directory)))
      .filter((path) => !path.endsWith(BINARY_EXTENSION))
      .filter((path) => REMOVED_NAMES.some((name) => readRepositoryFile(path).includes(name)));
    expect(namingRemoved).toEqual([]);
  });
});
