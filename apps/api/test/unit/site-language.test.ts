import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { localeOfLanguageValue, localeOfPath, localePathOf, preferredLocaleOf } from '../../src/site/site-language';

describe('the language of the site by path', () => {
  it('gives English the root and Portuguese its own path', () => {
    expect(localePathOf({ locale: OwnerLocale.EnglishUs })).toBe('/');
    expect(localePathOf({ locale: OwnerLocale.PortugueseBrazil })).toBe('/pt-br');
  });

  it.each([
    ['/', OwnerLocale.EnglishUs],
    ['/pt-br', OwnerLocale.PortugueseBrazil],
  ])('reads %s', (pathname, locale) => {
    expect(localeOfPath({ pathname })).toBe(locale);
  });

  it.each(['/pt-br/', '/PT-BR', '/en', '/pt-br/x', '/join', ''])('does not read %j as a language path', (pathname) => {
    expect(localeOfPath({ pathname })).toBeNull();
  });
});

describe('the legacy language values', () => {
  it.each([
    ['en', OwnerLocale.EnglishUs],
    ['en_US', OwnerLocale.EnglishUs],
    ['pt-BR', OwnerLocale.PortugueseBrazil],
    ['pt_BR', OwnerLocale.PortugueseBrazil],
  ])('reads %s', (value, locale) => {
    expect(localeOfLanguageValue({ value })).toBe(locale);
  });

  it.each([undefined, '', 'xx', 'PT-BR', 'pt', 'en-US'])('refuses %j', (value) => {
    expect(localeOfLanguageValue({ value })).toBeNull();
  });
});

describe('the preferred language of a visitor to the root', () => {
  const english = OwnerLocale.EnglishUs;
  const portuguese = OwnerLocale.PortugueseBrazil;

  it.each([
    [undefined, undefined, english],
    [undefined, 'en-US,en;q=0.9', english],
    [undefined, 'pt-BR,pt;q=0.9', portuguese],
    [undefined, 'pt', portuguese],
    [undefined, 'fr-FR', english],
    [portuguese, 'en-US', portuguese],
    [english, 'pt-BR', english],
    ['xx', 'pt-BR', portuguese],
  ])('with cookie %j and Accept-Language %j shows %s', (cookieValue, acceptLanguage, expected) => {
    expect(preferredLocaleOf({ cookieValue, acceptLanguage })).toBe(expected);
  });
});
