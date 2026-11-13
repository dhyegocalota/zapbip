import { OwnerLocale, PRICING_FREE_MESSAGES } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { ClientAppCopyKey, renderClientAppCopy } from '../../src/client-app/client-app-copy';

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const KEYS = Object.values(ClientAppCopyKey);

function placeholdersOf(input: { key: ClientAppCopyKey; locale: OwnerLocale }): string[] {
  return [...renderClientAppCopy(input).matchAll(PLACEHOLDER_PATTERN)].map(([, name]) => name!).sort();
}

describe('the customer web app copy', () => {
  it.each(Object.values(OwnerLocale))('has a text for every key in %s', (locale) => {
    expect(KEYS.filter((key) => renderClientAppCopy({ key, locale }).trim() === '')).toEqual([]);
  });

  it('uses the same placeholders in both languages', () => {
    const mismatched = KEYS.filter(
      (key) =>
        placeholdersOf({ key, locale: OwnerLocale.EnglishUs }).join() !==
        placeholdersOf({ key, locale: OwnerLocale.PortugueseBrazil }).join(),
    );
    expect(mismatched).toEqual([]);
  });

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
