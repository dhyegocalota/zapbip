import { describe, expect, test } from 'vitest';
import { DOCS_LANGUAGE_FOLDERS, DOCS_OWNER_LOCALES } from './constants';
import { DocsPageLanguage, OwnerLocale } from './enums';

const LANGUAGES = Object.values(DocsPageLanguage);
const TRANSLATED_LANGUAGES = LANGUAGES.filter((language) => language !== DocsPageLanguage.English);

describe('the documentation languages', () => {
  test('there are nine, English first, with the Mintlify codes', () => {
    expect(LANGUAGES).toEqual(['en', 'pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh', 'ar']);
  });

  test('English has no folder and every other language has its own', () => {
    expect(DOCS_LANGUAGE_FOLDERS[DocsPageLanguage.English]).toBe('');
    const folders = TRANSLATED_LANGUAGES.map((language) => DOCS_LANGUAGE_FOLDERS[language]);
    expect(new Set(folders).size).toBe(TRANSLATED_LANGUAGES.length);
    expect(folders.every((folder) => /^[a-z]{2}(-[a-z]{2})?$/.test(folder))).toBe(true);
  });

  test('every documentation language is written with the owner words of its own language', () => {
    const locales = LANGUAGES.map((language) => DOCS_OWNER_LOCALES[language]);
    expect(new Set(locales).size).toBe(LANGUAGES.length);
    expect(DOCS_OWNER_LOCALES[DocsPageLanguage.PortugueseBrazil]).toBe(OwnerLocale.PortugueseBrazil);
    expect(DOCS_OWNER_LOCALES[DocsPageLanguage.Chinese]).toBe(OwnerLocale.ChineseSimplified);
  });
});
