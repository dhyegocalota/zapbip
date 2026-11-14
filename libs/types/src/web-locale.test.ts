import { describe, expect, it } from 'vitest';
import { OWNER_LOCALE_OF_WEB_LOCALE, WEB_LOCALE_OF_OWNER_LOCALE, WEB_LOCALE_PATH_PREFIXES } from './constants';
import { OwnerLocale, WebLanguageTag, WebLocale } from './enums';

const WEB_LOCALES = Object.values(WebLocale);

describe('the web locales', () => {
  it('are the eight languages of the web surfaces', () => {
    expect(WEB_LOCALES).toHaveLength(8);
    expect(Object.values(WebLanguageTag)).toHaveLength(WEB_LOCALES.length);
  });

  it('keep the owner locale values so a stored locale still reads', () => {
    expect(WebLocale.EnglishUs).toBe(OwnerLocale.EnglishUs);
    expect(WebLocale.PortugueseBrazil).toBe(OwnerLocale.PortugueseBrazil);
  });

  it('give every language its own path prefix and only English the root', () => {
    const prefixes = WEB_LOCALES.map((locale) => WEB_LOCALE_PATH_PREFIXES[locale]);
    expect(new Set(prefixes).size).toBe(WEB_LOCALES.length);
    expect(prefixes.filter((prefix) => prefix === '')).toHaveLength(1);
    expect(WEB_LOCALE_PATH_PREFIXES[WebLocale.EnglishUs]).toBe('');
  });

  it('send every language without WhatsApp copy to English until that copy exists', () => {
    expect(OWNER_LOCALE_OF_WEB_LOCALE[WebLocale.PortugueseBrazil]).toBe(OwnerLocale.PortugueseBrazil);
    expect(WEB_LOCALES.filter((locale) => OWNER_LOCALE_OF_WEB_LOCALE[locale] === OwnerLocale.EnglishUs)).toHaveLength(
      WEB_LOCALES.length - 1,
    );
  });

  it('round-trip each owner locale', () => {
    Object.values(OwnerLocale).forEach((locale) => {
      expect(OWNER_LOCALE_OF_WEB_LOCALE[WEB_LOCALE_OF_OWNER_LOCALE[locale]]).toBe(locale);
    });
  });
});
