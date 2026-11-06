import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';
import { existsSync } from 'node:fs';

const DOCS_CONFIG = 'apps/docs/docs.json';
const NAVIGATION_GROUPS = ['Get started', 'Agents', 'Features', 'Help', 'Reference'];

type NavigationNode = string | { group: string; pages: NavigationNode[] };

function pagesOf(nodes: NavigationNode[]): string[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? [node] : pagesOf(node.pages)));
}

const navigation = JSON.parse(readRepositoryFile(DOCS_CONFIG)).navigation.groups as { group: string; pages: NavigationNode[] }[];

describe('docs navigation', () => {
  test('the top-level groups are user-first and in order', () => {
    expect(navigation.map((entry) => entry.group)).toEqual(NAVIGATION_GROUPS);
  });

  test('every listed page exists', () => {
    const missing = pagesOf(navigation.flatMap((entry) => entry.pages)).filter(
      (page) => !existsSync(repositoryPath(`apps/docs/${page}.mdx`)),
    );
    expect(missing).toEqual([]);
  });
});
