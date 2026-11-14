import { WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { localeOfLanguageValue, localeOfPath, localePathOf, preferredLocaleOf } from '../../src/site/site-language';

const LANGUAGE_PATHS: [WebLocale, string][] = [
  [WebLocale.EnglishUs, '/'],
  [WebLocale.PortugueseBrazil, '/pt-br'],
  [WebLocale.Spanish, '/es'],
  [WebLocale.German, '/de'],
  [WebLocale.French, '/fr'],
  [WebLocale.Japanese, '/ja'],
  [WebLocale.Korean, '/ko'],
  [WebLocale.ChineseSimplified, '/zh'],
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
    ['en', WebLocale.EnglishUs],
    ['en_US', WebLocale.EnglishUs],
    ['pt-BR', WebLocale.PortugueseBrazil],
    ['pt_BR', WebLocale.PortugueseBrazil],
    ['es', WebLocale.Spanish],
    ['de', WebLocale.German],
    ['fr', WebLocale.French],
    ['ja', WebLocale.Japanese],
    ['ko', WebLocale.Korean],
    ['zh-CN', WebLocale.ChineseSimplified],
    ['zh_CN', WebLocale.ChineseSimplified],
  ])('reads %s', (value, locale) => {
    expect(localeOfLanguageValue({ value })).toBe(locale);
  });

  it.each([undefined, '', 'xx', 'PT-BR', 'pt', 'en-US', 'zh', 'ES'])('refuses %j', (value) => {
    expect(localeOfLanguageValue({ value })).toBeNull();
  });
});

describe('the preferred language of a visitor to the root', () => {
  it.each([
    [undefined, undefined, WebLocale.EnglishUs],
    [undefined, 'en-US,en;q=0.9', WebLocale.EnglishUs],
    [undefined, 'pt-BR,pt;q=0.9', WebLocale.PortugueseBrazil],
    [undefined, 'pt', WebLocale.PortugueseBrazil],
    [undefined, 'es-MX,es;q=0.9', WebLocale.Spanish],
    [undefined, 'de-AT', WebLocale.German],
    [undefined, 'fr-CA,fr;q=0.8', WebLocale.French],
    [undefined, 'ja-JP', WebLocale.Japanese],
    [undefined, 'ko-KR', WebLocale.Korean],
    [undefined, 'zh', WebLocale.ChineseSimplified],
    [undefined, 'zh-CN,zh;q=0.9', WebLocale.ChineseSimplified],
    [undefined, 'zh-Hans-SG', WebLocale.ChineseSimplified],
    [undefined, 'zh-TW', WebLocale.EnglishUs],
    [undefined, 'zh-Hant', WebLocale.EnglishUs],
    [undefined, 'it-IT,it;q=0.9', WebLocale.EnglishUs],
    [undefined, 'fr;q=0.5, de;q=0.9, en;q=0.1', WebLocale.German],
    [undefined, 'it, ja;q=0.4, ko;q=0.6', WebLocale.Korean],
    [undefined, 'ja;q=0, en;q=0.2', WebLocale.EnglishUs],
    [undefined, '*', WebLocale.EnglishUs],
    [undefined, 'ES', WebLocale.Spanish],
    [WebLocale.PortugueseBrazil, 'en-US', WebLocale.PortugueseBrazil],
    [WebLocale.EnglishUs, 'ja', WebLocale.EnglishUs],
    [WebLocale.Korean, 'en', WebLocale.Korean],
    ['xx', 'pt-BR', WebLocale.PortugueseBrazil],
  ])('with cookie %j and Accept-Language %j shows %s', (cookieValue, acceptLanguage, expected) => {
    expect(preferredLocaleOf({ cookieValue, acceptLanguage })).toBe(expected);
  });
});
