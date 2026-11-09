import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { startLinkLocaleOf } from '../../src/routes/start-link-language';

describe('startLinkLocaleOf', () => {
  it('maps the English docs language to en_US', () => {
    expect(startLinkLocaleOf({ values: [DocsLanguage.English] })).toBe(OwnerLocale.EnglishUs);
  });

  it('maps the Portuguese docs language to pt_BR', () => {
    expect(startLinkLocaleOf({ values: [DocsLanguage.PortugueseBrazil] })).toBe(OwnerLocale.PortugueseBrazil);
  });

  it('takes the product default locale when the parameter is absent', () => {
    expect(startLinkLocaleOf({ values: undefined })).toBe(OwnerLocale.PortugueseBrazil);
  });

  it.each(['fr', '', 'EN', 'pt-br', 'pt_BR', 'en_US', 'en ', '__proto__', 'constructor'])('refuses the unknown value %j', (value) => {
    expect(startLinkLocaleOf({ values: [value] })).toBeNull();
  });

  it('refuses a repeated parameter, even when every value is valid', () => {
    expect(startLinkLocaleOf({ values: [DocsLanguage.English, DocsLanguage.English] })).toBeNull();
    expect(startLinkLocaleOf({ values: [DocsLanguage.English, DocsLanguage.PortugueseBrazil] })).toBeNull();
  });
});
