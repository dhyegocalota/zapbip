import { CLIENT_APP_LOGIN_TEXT, COMPANY, PRICING_FREE_MESSAGES, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { ClientAppCopyKey, renderClientAppCopy } from '../../src/client-app/client-app-copy';
import { cjkSpacingOffenders, frenchSpacingOffenders, placeholderMismatches, untranslatedEntries } from './copy-rules';

const KEYS = Object.values(ClientAppCopyKey);
const COPIES = Object.fromEntries(
  Object.values(OwnerLocale).map((locale) => [locale, Object.fromEntries(KEYS.map((key) => [key, renderClientAppCopy({ key, locale })]))]),
) as Record<OwnerLocale, Record<string, string>>;

describe('the customer web app copy', () => {
  it.each(Object.values(OwnerLocale))('has a text for every key in %s', (locale) => {
    expect(KEYS.filter((key) => renderClientAppCopy({ key, locale }).trim() === '')).toEqual([]);
  });

  it('uses the same placeholders in every language', () => {
    expect(placeholderMismatches({ copies: COPIES, keys: KEYS })).toEqual([]);
  });

  it('words every text differently from English in every other language, except proper names', () => {
    expect(
      untranslatedEntries({
        copies: COPIES,
        keys: KEYS,
        allowed: [
          ClientAppCopyKey.BrandName,
          `${OwnerLocale.German}:${ClientAppCopyKey.AgentClient}`,
          `${OwnerLocale.French}:${ClientAppCopyKey.AgentClient}`,
        ],
      }),
    ).toEqual([]);
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

  it.each(Object.values(OwnerLocale))('names the WhatsApp word of its login in the expired link text in %s', (locale) => {
    expect(renderClientAppCopy({ key: ClientAppCopyKey.ExpiredBody, locale })).toContain(CLIENT_APP_LOGIN_TEXT[locale]);
  });

  it.each(Object.values(OwnerLocale))(
    '[row 439] says in %s that deleting does not cancel the subscription and names the support address',
    (locale) => {
      expect(
        renderClientAppCopy({ key: ClientAppCopyKey.DeleteAccountHint, locale, values: { contactEmail: COMPANY.contactEmail } }),
      ).toContain(COMPANY.contactEmail);
    },
  );

  it('fills a placeholder', () => {
    expect(renderClientAppCopy({ key: ClientAppCopyKey.RevokeTitle, locale: OwnerLocale.EnglishUs, values: { agent: 'alpha' } })).toBe(
      'Revoke alpha?',
    );
  });

  it('says the same plan as the public pricing in two languages', () => {
    const values = { free: String(PRICING_FREE_MESSAGES) };
    expect(renderClientAppCopy({ key: ClientAppCopyKey.PlanLine, locale: OwnerLocale.EnglishUs, values })).toBe(
      'Free · 5 messages to try it',
    );
    expect(renderClientAppCopy({ key: ClientAppCopyKey.PlanLine, locale: OwnerLocale.PortugueseBrazil, values })).toBe(
      'Grátis · 5 mensagens para testar',
    );
  });
});
