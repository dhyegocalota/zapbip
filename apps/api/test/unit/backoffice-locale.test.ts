import { DEFAULT_LOCALE, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { resolveLocale } from '../../src/backoffice/locale';

describe('resolveLocale', () => {
  it('prefers the cookie over the Accept-Language header (pin)', () => {
    expect(resolveLocale({ cookieValue: OwnerLocale.EnglishUs, acceptLanguage: 'pt-BR' })).toBe(OwnerLocale.EnglishUs);
  });

  it('ignores an unknown cookie and follows an English header (pin)', () => {
    expect(resolveLocale({ cookieValue: 'fr_FR', acceptLanguage: 'en-GB' })).toBe(OwnerLocale.EnglishUs);
  });

  it('falls to the default locale with neither (pin)', () => {
    expect(resolveLocale({ cookieValue: undefined, acceptLanguage: undefined })).toBe(DEFAULT_LOCALE);
  });
});
