import { readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_ROOT = 'apps/docs';
const CONNECTOR_MANIFEST = 'apps/connector/package.json';
const PAGE_EXTENSION = '.mdx';
const IGNORED_DIRECTORIES = ['node_modules'];
const UNPINNED_COMMAND = /npx zapbip(?!@)/g;
const PINNED_COMMAND = /npx zapbip@([0-9][^\s"]*)/g;

function pageFiles(directory: string): string[] {
  return readdirSync(repositoryPath(posix.join(DOCS_ROOT, directory)), { withFileTypes: true })
    .filter((entry) => !IGNORED_DIRECTORIES.includes(entry.name))
    .flatMap((entry) => {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) return pageFiles(path);
      return entry.name.endsWith(PAGE_EXTENSION) ? [path] : [];
    });
}

const connectorVersion = JSON.parse(readRepositoryFile(CONNECTOR_MANIFEST)).version as string;
const pages = pageFiles('').map((path) => ({ path, text: readRepositoryFile(posix.join(DOCS_ROOT, path)) }));

describe('the pinned connector version in the docs', () => {
  test('the connector manifest declares a version', () => {
    expect(connectorVersion).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+$/);
  });

  test('no page runs the connector without a version', () => {
    const unpinned = pages.filter((page) => UNPINNED_COMMAND.test(page.text)).map((page) => page.path);
    UNPINNED_COMMAND.lastIndex = 0;
    expect(unpinned).toEqual([]);
  });

  test('every pinned command names the version of the manifest', () => {
    const versions = pages.flatMap((page) => [...page.text.matchAll(PINNED_COMMAND)].map((match) => match[1]));
    expect(new Set(versions)).toEqual(new Set([connectorVersion]));
  });
});
