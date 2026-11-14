import { DocsPageLanguage, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { startLinkLocaleOf } from '../../src/routes/start-link-language';

describe('startLinkLocaleOf', () => {
  it('maps the English docs language to en_US', () => {
    expect(startLinkLocaleOf({ values: [DocsPageLanguage.English] })).toBe(OwnerLocale.EnglishUs);
  });

  it('maps the Portuguese docs language to pt_BR', () => {
    expect(startLinkLocaleOf({ values: [DocsPageLanguage.PortugueseBrazil] })).toBe(OwnerLocale.PortugueseBrazil);
  });

  it.each([
    [DocsPageLanguage.Spanish, OwnerLocale.Spanish],
    [DocsPageLanguage.German, OwnerLocale.German],
    [DocsPageLanguage.French, OwnerLocale.French],
    [DocsPageLanguage.Japanese, OwnerLocale.Japanese],
    [DocsPageLanguage.Korean, OwnerLocale.Korean],
    [DocsPageLanguage.Chinese, OwnerLocale.ChineseSimplified],
  ])('maps the %s docs language to %s', (language, locale) => {
    expect(startLinkLocaleOf({ values: [language] })).toBe(locale);
  });

  it('takes the product default locale when the parameter is absent', () => {
    expect(startLinkLocaleOf({ values: undefined })).toBe(OwnerLocale.PortugueseBrazil);
  });

  it.each(['', 'EN', 'zh-CN', 'zh_CN', 'es-MX', 'FR', 'it', 'pt-br', 'pt_BR', 'en_US', 'en ', '__proto__', 'constructor'])(
    'refuses the unknown value %j',
    (value) => {
      expect(startLinkLocaleOf({ values: [value] })).toBeNull();
    },
  );

  it('refuses a repeated parameter, even when every value is valid', () => {
    expect(startLinkLocaleOf({ values: [DocsPageLanguage.English, DocsPageLanguage.English] })).toBeNull();
    expect(startLinkLocaleOf({ values: [DocsPageLanguage.English, DocsPageLanguage.PortugueseBrazil] })).toBeNull();
  });
});
