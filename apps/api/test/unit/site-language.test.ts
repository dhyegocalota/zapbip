import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { localeOfLanguageValue, localeOfPath, localePathOf, preferredLocaleOf } from '../../src/site/site-language';

const LANGUAGE_PATHS: [OwnerLocale, string][] = [
  [OwnerLocale.EnglishUs, '/'],
  [OwnerLocale.PortugueseBrazil, '/pt-br'],
  [OwnerLocale.Spanish, '/es'],
  [OwnerLocale.German, '/de'],
  [OwnerLocale.French, '/fr'],
  [OwnerLocale.Japanese, '/ja'],
  [OwnerLocale.Korean, '/ko'],
  [OwnerLocale.ChineseSimplified, '/zh'],
];

describe('the language of the site by path', () => {
  it.each(LANGUAGE_PATHS)('gives %s the path %s', (locale, path) => {
    expect(localePathOf({ locale })).toBe(path);
  });

  it.each(LANGUAGE_PATHS)('reads %s back as %s', (locale, pathname) => {
    expect(localeOfPath({ pathname })).toBe(locale);
  });

  it.each(['/pt-br/', '/PT-BR', '/en', '/pt-br/x', '/join', '', '/es/', '/zh-cn', '/jp'])(
    'does not read %j as a language path',
    (pathname) => {
      expect(localeOfPath({ pathname })).toBeNull();
    },
  );
});

describe('the legacy language values', () => {
  it.each([
    ['en', OwnerLocale.EnglishUs],
    ['en_US', OwnerLocale.EnglishUs],
    ['pt-BR', OwnerLocale.PortugueseBrazil],
    ['pt_BR', OwnerLocale.PortugueseBrazil],
    ['es', OwnerLocale.Spanish],
    ['de', OwnerLocale.German],
    ['fr', OwnerLocale.French],
    ['ja', OwnerLocale.Japanese],
    ['ko', OwnerLocale.Korean],
    ['zh-CN', OwnerLocale.ChineseSimplified],
    ['zh_CN', OwnerLocale.ChineseSimplified],
  ])('reads %s', (value, locale) => {
    expect(localeOfLanguageValue({ value })).toBe(locale);
  });

  it.each([undefined, '', 'xx', 'PT-BR', 'pt', 'en-US', 'zh', 'ES'])('refuses %j', (value) => {
    expect(localeOfLanguageValue({ value })).toBeNull();
  });
});

describe('the preferred language of a visitor to the root', () => {
  it.each([
    [undefined, undefined, OwnerLocale.EnglishUs],
    [undefined, 'en-US,en;q=0.9', OwnerLocale.EnglishUs],
    [undefined, 'pt-BR,pt;q=0.9', OwnerLocale.PortugueseBrazil],
    [undefined, 'pt', OwnerLocale.PortugueseBrazil],
    [undefined, 'es-MX,es;q=0.9', OwnerLocale.Spanish],
    [undefined, 'de-AT', OwnerLocale.German],
    [undefined, 'fr-CA,fr;q=0.8', OwnerLocale.French],
    [undefined, 'ja-JP', OwnerLocale.Japanese],
    [undefined, 'ko-KR', OwnerLocale.Korean],
    [undefined, 'zh', OwnerLocale.ChineseSimplified],
    [undefined, 'zh-CN,zh;q=0.9', OwnerLocale.ChineseSimplified],
    [undefined, 'zh-Hans-SG', OwnerLocale.ChineseSimplified],
    [undefined, 'zh-TW', OwnerLocale.EnglishUs],
    [undefined, 'zh-Hant', OwnerLocale.EnglishUs],
    [undefined, 'it-IT,it;q=0.9', OwnerLocale.EnglishUs],
    [undefined, 'fr;q=0.5, de;q=0.9, en;q=0.1', OwnerLocale.German],
    [undefined, 'it, ja;q=0.4, ko;q=0.6', OwnerLocale.Korean],
    [undefined, 'ja;q=0, en;q=0.2', OwnerLocale.EnglishUs],
    [undefined, '*', OwnerLocale.EnglishUs],
    [undefined, 'ES', OwnerLocale.Spanish],
    [OwnerLocale.PortugueseBrazil, 'en-US', OwnerLocale.PortugueseBrazil],
    [OwnerLocale.EnglishUs, 'ja', OwnerLocale.EnglishUs],
    [OwnerLocale.Korean, 'en', OwnerLocale.Korean],
    ['xx', 'pt-BR', OwnerLocale.PortugueseBrazil],
  ])('with cookie %j and Accept-Language %j shows %s', (cookieValue, acceptLanguage, expected) => {
    expect(preferredLocaleOf({ cookieValue, acceptLanguage })).toBe(expected);
  });
});
