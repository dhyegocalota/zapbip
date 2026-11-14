import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { localeOfPath, pathWithLocale } from '../../src/client-app/client-app-paths';

describe('localeOfPath', () => {
  it.each([
    ['/', OwnerLocale.EnglishUs],
    ['/agents', OwnerLocale.EnglishUs],
    ['/pt-br', OwnerLocale.PortugueseBrazil],
    ['/pt-br/', OwnerLocale.PortugueseBrazil],
    ['/pt-br/sign-in/abc', OwnerLocale.PortugueseBrazil],
    ['/pt-brasil', OwnerLocale.EnglishUs],
    ['/es', OwnerLocale.Spanish],
    ['/de/agents', OwnerLocale.German],
    ['/fr/sign-in/abc', OwnerLocale.French],
    ['/ja', OwnerLocale.Japanese],
    ['/ko/', OwnerLocale.Korean],
    ['/zh/agents/revoke', OwnerLocale.ChineseSimplified],
    ['/zhuang', OwnerLocale.EnglishUs],
    ['/espanol', OwnerLocale.EnglishUs],
  ])('reads %s as %s', (path, locale) => {
    expect(localeOfPath({ path })).toBe(locale);
  });
});

describe('pathWithLocale', () => {
  it.each([
    [OwnerLocale.EnglishUs, '/', '/'],
    [OwnerLocale.EnglishUs, '/agents', '/agents'],
    [OwnerLocale.PortugueseBrazil, '/', '/pt-br'],
    [OwnerLocale.PortugueseBrazil, '/agents', '/pt-br/agents'],
    [OwnerLocale.Spanish, '/', '/es'],
    [OwnerLocale.German, '/agents', '/de/agents'],
    [OwnerLocale.French, '/sign-in/abc', '/fr/sign-in/abc'],
    [OwnerLocale.Japanese, '/', '/ja'],
    [OwnerLocale.Korean, '/agents/revoke', '/ko/agents/revoke'],
    [OwnerLocale.ChineseSimplified, '/', '/zh'],
  ])('gives %s %s the path %s', (locale, path, expected) => {
    expect(pathWithLocale({ locale, path })).toBe(expected);
  });
});
