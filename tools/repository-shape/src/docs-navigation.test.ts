import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_ROOT = 'apps/docs';
const DOCS_CONFIG = `${DOCS_ROOT}/docs.json`;
const DEFAULT_LANGUAGE = 'en';
const TRANSLATED_LANGUAGE = 'pt-BR';
const TRANSLATED_DIRECTORY = 'pt-br';
const PAGE_EXTENSION = '.mdx';
const SNIPPETS_DIRECTORY = 'snippets';
const PAGE_DIRECTORY_MARKERS = ['node_modules'];
const GROUP_COUNT = 5;

type NavigationNode = string | { group: string; pages: NavigationNode[] };
type LanguageNavigation = { language: string; groups: { group: string; pages: NavigationNode[] }[] };

function pagesOf(nodes: NavigationNode[]): string[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? [node] : pagesOf(node.pages)));
}

function documentFiles(directory: string): string[] {
  return readdirSync(repositoryPath(posix.join(DOCS_ROOT, directory)), { withFileTypes: true })
    .filter((entry) => !PAGE_DIRECTORY_MARKERS.includes(entry.name))
    .flatMap((entry) => {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) return documentFiles(path);
      return entry.name.endsWith(PAGE_EXTENSION) ? [path] : [];
    });
}

function withoutTranslatedDirectory(path: string): string {
  return path.replace(new RegExp(`(^|/)${TRANSLATED_DIRECTORY}/`), '$1');
}

const languages = JSON.parse(readRepositoryFile(DOCS_CONFIG)).navigation.languages as LanguageNavigation[];
const navigationOf = (language: string): LanguageNavigation => {
  const found = languages.find((entry) => entry.language === language);
  if (!found) throw new Error(`no navigation for ${language}`);
  return found;
};
const documents = documentFiles('');
const isTranslated = (path: string): boolean => path.split('/').includes(TRANSLATED_DIRECTORY);

describe('docs navigation', () => {
  test('both languages are published, the default first', () => {
    expect(languages.map((entry) => entry.language)).toEqual([DEFAULT_LANGUAGE, TRANSLATED_LANGUAGE]);
  });

  test('both languages have the same top-level shape', () => {
    const shapes = languages.map((entry) => entry.groups.length);
    expect(shapes).toEqual([GROUP_COUNT, GROUP_COUNT]);
  });

  test('the default language groups are user-first and in order', () => {
    expect(navigationOf(DEFAULT_LANGUAGE).groups.map((entry) => entry.group)).toEqual([
      'Get started',
      'Agents',
      'Features',
      'Help',
      'For developers',
    ]);
  });

  test.each(languages)('every page listed for $language exists', (entry) => {
    const missing = pagesOf(entry.groups.flatMap((group) => group.pages)).filter(
      (page) => !existsSync(repositoryPath(`${DOCS_ROOT}/${page}${PAGE_EXTENSION}`)),
    );
    expect(missing).toEqual([]);
  });

  test('every default page has its twin in the translated language', () => {
    const missing = documents
      .filter((path) => !isTranslated(path))
      .map((path) =>
        path.startsWith(`${SNIPPETS_DIRECTORY}/`)
          ? path.replace(`${SNIPPETS_DIRECTORY}/`, `${SNIPPETS_DIRECTORY}/${TRANSLATED_DIRECTORY}/`)
          : `${TRANSLATED_DIRECTORY}/${path}`,
      )
      .filter((twin) => !documents.includes(twin));
    expect(missing).toEqual([]);
  });

  test('every translated page has its twin in the default language', () => {
    const orphans = documents.filter(isTranslated).filter((path) => !documents.includes(withoutTranslatedDirectory(path)));
    expect(orphans).toEqual([]);
  });
});
