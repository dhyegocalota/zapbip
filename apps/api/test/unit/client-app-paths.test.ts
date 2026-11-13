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
  ])('gives %s %s the path %s', (locale, path, expected) => {
    expect(pathWithLocale({ locale, path })).toBe(expected);
  });
});
