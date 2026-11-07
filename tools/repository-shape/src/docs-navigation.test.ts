import { existsSync } from 'node:fs';
import { DocsLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { DOCS_GROUPS, PAGE_LANGUAGE_FOLDER, docsNavigationOf, navigationPagesOf } from './docs-experience';
import { DOCS_ROOT, PAGE_EXTENSION, documentFiles, repositoryPath } from './repository-files';

const SNIPPETS_DIRECTORY = 'snippets';
const GROUP_COUNT = 5;

const LANGUAGES = Object.values(DocsLanguage);

function withoutTranslatedDirectory(path: string): string {
  return path.replace(new RegExp(`(^|/)${PAGE_LANGUAGE_FOLDER}/`), '$1');
}

const documents = documentFiles('');
const isTranslated = (path: string): boolean => path.split('/').includes(PAGE_LANGUAGE_FOLDER);

describe('docs navigation', () => {
  test('both languages are published, the default first', () => {
    expect(LANGUAGES.map((language) => docsNavigationOf({ language }).language)).toEqual([
      DocsLanguage.English,
      DocsLanguage.PortugueseBrazil,
    ]);
  });

  test('both languages have the same top-level shape', () => {
    const shapes = LANGUAGES.map((language) => docsNavigationOf({ language }).groups.length);
    expect(shapes).toEqual([GROUP_COUNT, GROUP_COUNT]);
  });

  test('the default language groups are user-first and in order', () => {
    expect(docsNavigationOf({ language: DocsLanguage.English }).groups.map((entry) => entry.group)).toEqual(
      DOCS_GROUPS[DocsLanguage.English],
    );
  });

  test.each(LANGUAGES)('every page listed for %s exists', (language) => {
    const missing = navigationPagesOf({ language }).filter((page) => !existsSync(repositoryPath(`${DOCS_ROOT}/${page}${PAGE_EXTENSION}`)));
    expect(missing).toEqual([]);
  });

  test('every default page has its twin in the translated language', () => {
    const missing = documents
      .filter((path) => !isTranslated(path))
      .map((path) =>
        path.startsWith(`${SNIPPETS_DIRECTORY}/`)
          ? path.replace(`${SNIPPETS_DIRECTORY}/`, `${SNIPPETS_DIRECTORY}/${PAGE_LANGUAGE_FOLDER}/`)
          : `${PAGE_LANGUAGE_FOLDER}/${path}`,
      )
      .filter((twin) => !documents.includes(twin));
    expect(missing).toEqual([]);
  });

  test('every translated page has its twin in the default language', () => {
    const orphans = documents.filter(isTranslated).filter((path) => !documents.includes(withoutTranslatedDirectory(path)));
    expect(orphans).toEqual([]);
  });
});
