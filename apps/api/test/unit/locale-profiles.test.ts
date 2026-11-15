import { DOCS_LANGUAGE_FOLDERS, DocsPageLanguage, WebLanguageTag, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { FLAG_SPRITE, FLAG_SPRITE_HREF, Flag } from '../../src/web-shell/flags';
import { LOCALE_PROFILES, MENU_LOCALES, TextDirection, formattingLocaleOf, languageOf } from '../../src/web-shell/locale-profiles';
import { docsUrlOf } from '../../src/web-shell/shell-links';

const LOCALES = Object.values(OwnerLocale);
const FLAG_PATTERN = /data-flag="([a-z]+)"/;
const FLAG_COLOUR_PATTERN = /fill="#[0-9a-f]{6}"/g;

describe('the locale profiles', () => {
  it('list the ten languages in the order of the menu', () => {
    expect(MENU_LOCALES).toEqual(LOCALES);
    expect(MENU_LOCALES).toHaveLength(10);
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
    expect(LOCALE_PROFILES[OwnerLocale.Japanese].nativeName).toBe('日本語');
    expect(LOCALE_PROFILES[OwnerLocale.Korean].nativeName).toBe('한국어');
    expect(LOCALE_PROFILES[OwnerLocale.ChineseSimplified].nativeName).toBe('简体中文');
    expect(LOCALE_PROFILES[OwnerLocale.Hindi].nativeName).toBe('हिन्दी');
  });

  it('point every language at the documentation folder of its own language', () => {
    LOCALES.forEach((locale) => {
      const tag = LOCALE_PROFILES[locale].languageTag;
      const docsLanguage = Object.values(DocsPageLanguage).find(
        (candidate) => (tag as string) === candidate || tag.startsWith(`${candidate}-`),
      )!;
      const folder = DOCS_LANGUAGE_FOLDERS[docsLanguage];
      expect(LOCALE_PROFILES[locale].docsPath).toBe(folder === '' ? '' : `/${folder}`);
    });
  });

  it.each([
    [OwnerLocale.Spanish, '/es'],
    [OwnerLocale.German, '/de'],
    [OwnerLocale.French, '/fr'],
    [OwnerLocale.Japanese, '/ja'],
    [OwnerLocale.Korean, '/ko'],
    [OwnerLocale.ChineseSimplified, '/zh'],
    [OwnerLocale.Arabic, '/ar'],
    [OwnerLocale.Hindi, '/hi'],
  ])('sends the documentation link of %s to %s', (locale, folder) => {
    expect(docsUrlOf({ locale, path: '' })).toBe(`https://docs.zapbip.com${folder}`);
    expect(docsUrlOf({ locale, path: '/mcp' })).toBe(`https://docs.zapbip.com${folder}/mcp`);
  });
});

describe('the flags', () => {
  it.each(LOCALES)('draw %s from the flag sprite under its own name, with no image', (locale) => {
    const html = String(Flag({ locale }));
    const name = FLAG_PATTERN.exec(html)![1];
    expect(html).toContain(`${FLAG_SPRITE_HREF}#flag-${name}`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<img|https?:/);
    expect(FLAG_SPRITE).toContain(`<symbol id="flag-${name}"`);
  });

  it('keep the colours of every flag in the sprite', () => {
    expect(FLAG_SPRITE.match(FLAG_COLOUR_PATTERN)!.length).toBeGreaterThanOrEqual(LOCALES.length * 2);
  });

  it('draw ten different flags', () => {
    const names = LOCALES.map((locale) => FLAG_PATTERN.exec(String(Flag({ locale })))![1]);
    expect(new Set(names).size).toBe(LOCALES.length);
  });
});

describe('the text direction', () => {
  it('is right to left for Arabic and left to right for every other language', () => {
    LOCALES.forEach((locale) =>
      expect(LOCALE_PROFILES[locale].textDirection).toBe(
        locale === OwnerLocale.Arabic ? TextDirection.RightToLeft : TextDirection.LeftToRight,
      ),
    );
  });

  it('keeps the digits of every language Latin when numbers are formatted', () => {
    LOCALES.forEach((locale) =>
      expect(new Intl.NumberFormat(formattingLocaleOf({ locale })).format(1234)).toMatch(/^1[,.\s\u00a0\u202f]?234$/),
    );
  });
});
