import { existsSync } from 'node:fs';
import { DocsPageLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { DOCS_GROUPS, docsNavigationOf, languageOfPage, navigationPagesOf, snippetPathOf, twinPathOf } from './docs-experience';
import { DOCS_ROOT, PAGE_EXTENSION, documentFiles, readRepositoryFile, repositoryPath } from './repository-files';

const SNIPPETS_DIRECTORY = 'snippets';
const GROUP_COUNT = 7;

const LANGUAGES = Object.values(DocsPageLanguage);
const TRANSLATED_LANGUAGES = LANGUAGES.filter((language) => language !== DocsPageLanguage.English);

const documents = documentFiles('');
const snippetPrefix = `${SNIPPETS_DIRECTORY}/`;

function languageOfDocument(path: string): DocsPageLanguage {
  const isSnippet = path.startsWith(snippetPrefix);
  return languageOfPage({ path: isSnippet ? path.slice(snippetPrefix.length) : path });
}

function twinOfDocument({ path, language }: { path: string; language: DocsPageLanguage }): string {
  const isSnippet = path.startsWith(snippetPrefix);
  if (!isSnippet) return twinPathOf({ path, language });
  const englishName = twinPathOf({ path: path.slice(snippetPrefix.length), language: DocsPageLanguage.English });
  return snippetPathOf({ name: englishName, language });
}

describe('docs navigation', () => {
  test('every language is published, the default first', () => {
    expect(LANGUAGES.map((language) => docsNavigationOf({ language }).language)).toEqual(LANGUAGES);
    expect(LANGUAGES[0]).toBe(DocsPageLanguage.English);
  });

  test('every language has the same top-level shape', () => {
    const shapes = LANGUAGES.map((language) => docsNavigationOf({ language }).groups.length);
    expect(shapes).toEqual(LANGUAGES.map(() => GROUP_COUNT));
  });

  test.each(LANGUAGES)('the %s groups are user-first and in order', (language) => {
    expect(docsNavigationOf({ language }).groups.map((entry) => entry.group)).toEqual(DOCS_GROUPS[language]);
  });

  test.each(LANGUAGES)('every page listed for %s exists', (language) => {
    const missing = navigationPagesOf({ language }).filter((page) => !existsSync(repositoryPath(`${DOCS_ROOT}/${page}${PAGE_EXTENSION}`)));
    expect(missing).toEqual([]);
  });

  test.each(LANGUAGES)('every page listed for %s lives in that language folder', (language) => {
    const strangers = navigationPagesOf({ language }).filter((page) => languageOfPage({ path: page }) !== language);
    expect(strangers).toEqual([]);
  });

  test.each(TRANSLATED_LANGUAGES)('every default page has its twin in %s', (language) => {
    const missing = documents
      .filter((path) => languageOfDocument(path) === DocsPageLanguage.English)
      .map((path) => twinOfDocument({ path, language }))
      .filter((twin) => !documents.includes(twin));
    expect(missing).toEqual([]);
  });

  test('every translated page has its twin in the default language', () => {
    const orphans = documents
      .filter((path) => languageOfDocument(path) !== DocsPageLanguage.English)
      .filter((path) => !documents.includes(twinOfDocument({ path, language: DocsPageLanguage.English })));
    expect(orphans).toEqual([]);
  });
});

type Redirect = { source: string; destination: string; permanent: boolean };

const DOCS_CONFIG = `${DOCS_ROOT}/docs.json`;
const LEADING_SLASH = '/';

const redirectsOf = (): Redirect[] => JSON.parse(readRepositoryFile(DOCS_CONFIG)).redirects;
const pageFileOfRoute = (route: string): string => repositoryPath(`${DOCS_ROOT}/${route.slice(LEADING_SLASH.length)}${PAGE_EXTENSION}`);

describe('docs redirects', () => {
  test('every redirect has a target that is a page', () => {
    const missing = redirectsOf()
      .map((redirect) => redirect.destination)
      .filter((destination) => !existsSync(pageFileOfRoute(destination)));
    expect(missing).toEqual([]);
  });

  test('no redirect source is still a page', () => {
    const stillPages = redirectsOf()
      .map((redirect) => redirect.source)
      .filter((source) => existsSync(pageFileOfRoute(source)));
    expect(stillPages).toEqual([]);
  });

  test('every redirect keeps its source and target in one language', () => {
    const crossing = redirectsOf().filter(
      (redirect) =>
        languageOfPage({ path: redirect.source.slice(LEADING_SLASH.length) }) !==
        languageOfPage({ path: redirect.destination.slice(LEADING_SLASH.length) }),
    );
    expect(crossing).toEqual([]);
  });
});
