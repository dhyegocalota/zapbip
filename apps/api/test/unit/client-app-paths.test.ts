import { WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { localeOfPath, pathWithLocale } from '../../src/client-app/client-app-paths';

describe('localeOfPath', () => {
  it.each([
    ['/', WebLocale.EnglishUs],
    ['/agents', WebLocale.EnglishUs],
    ['/pt-br', WebLocale.PortugueseBrazil],
    ['/pt-br/', WebLocale.PortugueseBrazil],
    ['/pt-br/sign-in/abc', WebLocale.PortugueseBrazil],
    ['/pt-brasil', WebLocale.EnglishUs],
    ['/es', WebLocale.Spanish],
    ['/de/agents', WebLocale.German],
    ['/fr/sign-in/abc', WebLocale.French],
    ['/ja', WebLocale.Japanese],
    ['/ko/', WebLocale.Korean],
    ['/zh/agents/revoke', WebLocale.ChineseSimplified],
    ['/zhuang', WebLocale.EnglishUs],
    ['/espanol', WebLocale.EnglishUs],
  ])('reads %s as %s', (path, locale) => {
    expect(localeOfPath({ path })).toBe(locale);
  });
});

describe('pathWithLocale', () => {
  it.each([
    [WebLocale.EnglishUs, '/', '/'],
    [WebLocale.EnglishUs, '/agents', '/agents'],
    [WebLocale.PortugueseBrazil, '/', '/pt-br'],
    [WebLocale.PortugueseBrazil, '/agents', '/pt-br/agents'],
    [WebLocale.Spanish, '/', '/es'],
    [WebLocale.German, '/agents', '/de/agents'],
    [WebLocale.French, '/sign-in/abc', '/fr/sign-in/abc'],
    [WebLocale.Japanese, '/', '/ja'],
    [WebLocale.Korean, '/agents/revoke', '/ko/agents/revoke'],
    [WebLocale.ChineseSimplified, '/', '/zh'],
  ])('gives %s %s the path %s', (locale, path, expected) => {
    expect(pathWithLocale({ locale, path })).toBe(expected);
  });
});
