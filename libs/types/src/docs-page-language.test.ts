import { describe, expect, test } from 'vitest';
import { DOCS_LANGUAGE_FOLDERS, DOCS_OWNER_LOCALES, DOCS_START_LINK_LANGUAGES } from './constants';
import { DocsLanguage, DocsPageLanguage, OwnerLocale } from './enums';

const LANGUAGES = Object.values(DocsPageLanguage);
const TRANSLATED_LANGUAGES = LANGUAGES.filter((language) => language !== DocsPageLanguage.English);

describe('the documentation languages', () => {
  test('there are eight, English first, with the Mintlify codes', () => {
    expect(LANGUAGES).toEqual(['en', 'pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh']);
  });

  test('English has no folder and every other language has its own', () => {
    expect(DOCS_LANGUAGE_FOLDERS[DocsPageLanguage.English]).toBe('');
    const folders = TRANSLATED_LANGUAGES.map((language) => DOCS_LANGUAGE_FOLDERS[language]);
    expect(new Set(folders).size).toBe(TRANSLATED_LANGUAGES.length);
    expect(folders.every((folder) => /^[a-z]{2}(-[a-z]{2})?$/.test(folder))).toBe(true);
  });

  test('only Portuguese is written with Portuguese owner words', () => {
    const portuguese = LANGUAGES.filter((language) => DOCS_OWNER_LOCALES[language] === OwnerLocale.PortugueseBrazil);
    expect(portuguese).toEqual([DocsPageLanguage.PortugueseBrazil]);
  });

  test('the start link asks for a language the API knows', () => {
    const known: string[] = Object.values(DocsLanguage);
    expect(LANGUAGES.every((language) => known.includes(DOCS_START_LINK_LANGUAGES[language]))).toBe(true);
    expect(DOCS_START_LINK_LANGUAGES[DocsPageLanguage.PortugueseBrazil]).toBe(DocsLanguage.PortugueseBrazil);
  });
});
