import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { ownerLanguageOfValue, ownerLocaleOf } from './owner-locale';

describe('the language of a new owner by calling code', () => {
  it.each([
    ['5511999990000', OwnerLocale.PortugueseBrazil],
    ['351912345678', OwnerLocale.PortugueseBrazil],
    ['34612345678', OwnerLocale.Spanish],
    ['5215512345678', OwnerLocale.Spanish],
    ['5491112345678', OwnerLocale.Spanish],
    ['573001234567', OwnerLocale.Spanish],
    ['4915112345678', OwnerLocale.German],
    ['436641234567', OwnerLocale.German],
    ['41791234567', OwnerLocale.German],
    ['33612345678', OwnerLocale.French],
    ['32470123456', OwnerLocale.French],
    ['352621123456', OwnerLocale.French],
    ['81901234567', OwnerLocale.Japanese],
    ['821012345678', OwnerLocale.Korean],
    ['8613812345678', OwnerLocale.ChineseSimplified],
  ])('reads %s as %s', (waId, locale) => {
    expect(ownerLocaleOf({ waId })).toBe(locale);
  });

  it.each(['14155550100', '447911123456', '85291234567', '886912345678', '61412345678', '919876543210', '2348012345678'])(
    'falls to English for %s, whose language has no copy',
    (waId) => {
      expect(ownerLocaleOf({ waId })).toBe(OwnerLocale.EnglishUs);
    },
  );

  it('prefers the longest calling code, so 351 is Portuguese and 3 alone is nothing', () => {
    expect(ownerLocaleOf({ waId: '351900000000' })).toBe(OwnerLocale.PortugueseBrazil);
    expect(ownerLocaleOf({ waId: '3999999999' })).toBe(OwnerLocale.EnglishUs);
  });

  it.each(['', 'abc', '+34612345678'])('falls to English for the malformed %j', (waId) => {
    expect(ownerLocaleOf({ waId })).toBe(OwnerLocale.EnglishUs);
  });
});

describe('the language an owner asks for', () => {
  it.each([
    ['en', OwnerLocale.EnglishUs],
    ['EN-us', OwnerLocale.EnglishUs],
    ['pt', OwnerLocale.PortugueseBrazil],
    ['pt-br', OwnerLocale.PortugueseBrazil],
    ['pt_BR', OwnerLocale.PortugueseBrazil],
    ['es', OwnerLocale.Spanish],
    ['de', OwnerLocale.German],
    ['fr', OwnerLocale.French],
    ['ja', OwnerLocale.Japanese],
    ['ko', OwnerLocale.Korean],
    ['zh', OwnerLocale.ChineseSimplified],
    ['zh-cn', OwnerLocale.ChineseSimplified],
    [' ZH_CN ', OwnerLocale.ChineseSimplified],
  ])('reads %j as %s', (value, locale) => {
    expect(ownerLanguageOfValue({ value })).toBe(locale);
  });

  it.each(['', 'xx', 'zh-tw', 'english', 'it'])('refuses %j', (value) => {
    expect(ownerLanguageOfValue({ value })).toBeNull();
  });
});
