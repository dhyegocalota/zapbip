import { DOCS_LANGUAGE_FOLDERS, DocsPageLanguage, WebLanguageTag, WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { Flag } from '../../src/web-shell/flags';
import { LOCALE_PROFILES, MENU_LOCALES, languageOf } from '../../src/web-shell/locale-profiles';
import { docsUrlOf } from '../../src/web-shell/shell-links';

const LOCALES = Object.values(WebLocale);
const FLAG_PATTERN = /data-flag="([a-z]+)"/;
const FLAG_COLOUR_PATTERN = /fill="#[0-9a-f]{6}"/g;

describe('the locale profiles', () => {
  it('list the eight languages in the order of the menu', () => {
    expect(MENU_LOCALES).toEqual(LOCALES);
    expect(MENU_LOCALES).toHaveLength(8);
  });

  it('give every language its own tag, short code, native name and Open Graph locale', () => {
    ['languageTag', 'shortName', 'nativeName', 'openGraphLocale', 'turnstileLanguage'].forEach((field) => {
      const values = LOCALES.map((locale) => String(LOCALE_PROFILES[locale][field as 'shortName']));
      expect(new Set(values).size).toBe(LOCALES.length);
    });
  });

  it('tag each language with the language tag of the web', () => {
    expect(LOCALES.map((locale) => languageOf({ locale }))).toEqual(Object.values(WebLanguageTag));
  });

  it('write each native name in its own script', () => {
    expect(LOCALE_PROFILES[WebLocale.Japanese].nativeName).toBe('日本語');
    expect(LOCALE_PROFILES[WebLocale.Korean].nativeName).toBe('한국어');
    expect(LOCALE_PROFILES[WebLocale.ChineseSimplified].nativeName).toBe('简体中文');
  });

  it('point every language at the documentation folder of its own language', () => {
    LOCALES.forEach((locale) => {
      const tag = LOCALE_PROFILES[locale].languageTag;
      const docsLanguage = Object.values(DocsPageLanguage).find((candidate) => tag === candidate || tag.startsWith(`${candidate}-`))!;
      const folder = DOCS_LANGUAGE_FOLDERS[docsLanguage];
      expect(LOCALE_PROFILES[locale].docsPath).toBe(folder === '' ? '' : `/${folder}`);
    });
  });

  it.each([
    [WebLocale.Spanish, '/es'],
    [WebLocale.German, '/de'],
    [WebLocale.French, '/fr'],
    [WebLocale.Japanese, '/ja'],
    [WebLocale.Korean, '/ko'],
    [WebLocale.ChineseSimplified, '/zh'],
  ])('sends the documentation link of %s to %s', (locale, folder) => {
    expect(docsUrlOf({ locale, path: '' })).toBe(`https://docs.zapbip.com${folder}`);
    expect(docsUrlOf({ locale, path: '/mcp' })).toBe(`https://docs.zapbip.com${folder}/mcp`);
  });
});

describe('the flags', () => {
  it.each(LOCALES)('draw an inline svg for %s with its own name and no outside image', (locale) => {
    const html = String(Flag({ locale }));
    expect(html).toMatch(FLAG_PATTERN);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<img|https?:|href=/);
    expect(html.match(FLAG_COLOUR_PATTERN)!.length).toBeGreaterThanOrEqual(2);
  });

  it('draw eight different flags', () => {
    const names = LOCALES.map((locale) => FLAG_PATTERN.exec(String(Flag({ locale })))![1]);
    expect(new Set(names).size).toBe(LOCALES.length);
  });
});
