import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { renderWelcomeEmailCopy, WelcomeEmailCopyKey } from '../../src/emails/welcome-email-copy';
import { cjkSpacingOffenders, emptyEntries, frenchSpacingOffenders, placeholderMismatches, untranslatedEntries } from './copy-rules';

const KEYS = Object.values(WelcomeEmailCopyKey);
const COPIES = Object.fromEntries(
  Object.values(OwnerLocale).map((locale) => [
    locale,
    Object.fromEntries(KEYS.map((key) => [key, renderWelcomeEmailCopy({ key, locale })])),
  ]),
) as Record<OwnerLocale, Record<string, string>>;

describe('the welcome email copy', () => {
  it('has a text for every key in every language', () => {
    expect(emptyEntries({ copies: COPIES, keys: KEYS })).toEqual([]);
  });

  it('uses the same placeholders in every language', () => {
    expect(placeholderMismatches({ copies: COPIES, keys: KEYS })).toEqual([]);
  });

  it('words every text differently from English in every other language', () => {
    expect(untranslatedEntries({ copies: COPIES, keys: KEYS, allowed: [] })).toEqual([]);
  });

  it('keeps the French punctuation spaces non-breaking', () => {
    expect(frenchSpacingOffenders({ texts: KEYS.map((key) => COPIES[OwnerLocale.French][key]!) })).toEqual([]);
  });

  it.each([OwnerLocale.Japanese, OwnerLocale.ChineseSimplified])(
    'puts no space between two Chinese or Japanese characters in %s',
    (locale) => {
      expect(cjkSpacingOffenders({ texts: KEYS.map((key) => COPIES[locale][key]!) })).toEqual([]);
    },
  );

  it('names the email address and the company in the footer of every language', () => {
    const footers = Object.values(OwnerLocale).map((locale) =>
      renderWelcomeEmailCopy({ key: WelcomeEmailCopyKey.Footer, locale, values: { email: 'maria@example.com', company: 'Logic Bit' } }),
    );
    expect(footers.filter((footer) => !footer.includes('maria@example.com') || !footer.includes('Logic Bit'))).toEqual([]);
  });

  it('isolates the left-to-right email address inside the Arabic footer', () => {
    const footer = renderWelcomeEmailCopy({
      key: WelcomeEmailCopyKey.Footer,
      locale: OwnerLocale.Arabic,
      values: { email: 'maria@example.com', company: 'Logic Bit' },
    });
    expect(footer).toContain('⁦maria@example.com⁩');
  });
});
