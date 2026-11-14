import { OwnerLocale, PricingCurrency } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { formatCompactCount, formatCount, formatPrice, pricingValuesOf } from '../../src/site/price-format';

const NO_BREAK_SPACE = ' ';

describe('formatPrice', () => {
  it.each([
    [0, PricingCurrency.Usd, OwnerLocale.EnglishUs, '$0'],
    [900, PricingCurrency.Usd, OwnerLocale.EnglishUs, '$9'],
    [500, PricingCurrency.Usd, OwnerLocale.EnglishUs, '$5'],
    [0, PricingCurrency.Brl, OwnerLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}0`],
    [4900, PricingCurrency.Brl, OwnerLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}49`],
    [2500, PricingCurrency.Brl, OwnerLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}25`],
    [1250, PricingCurrency.Usd, OwnerLocale.EnglishUs, '$12.50'],
    [1250, PricingCurrency.Brl, OwnerLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}12,50`],
  ])('writes %s cents in %s for %s as %s', (cents, currency, locale, expected) => {
    expect(formatPrice({ cents, currency, locale })).toBe(expected);
  });
});

describe('formatCount', () => {
  it.each([
    [5, OwnerLocale.EnglishUs, '5'],
    [1000, OwnerLocale.EnglishUs, '1,000'],
    [1000, OwnerLocale.PortugueseBrazil, '1.000'],
  ])('writes %s for %s as %s', (count, locale, expected) => {
    expect(formatCount({ count, locale })).toBe(expected);
  });
});

describe('formatCompactCount', () => {
  it.each([
    [987, OwnerLocale.EnglishUs, '987'],
    [1234, OwnerLocale.EnglishUs, '1.2K'],
    [12345, OwnerLocale.EnglishUs, '12.3K'],
    [1234, OwnerLocale.PortugueseBrazil, '1,2 mil'],
    [1234, OwnerLocale.Spanish, '1,2 mil'],
    [12345, OwnerLocale.German, '12.345'],
    [1234, OwnerLocale.French, `1,2${NO_BREAK_SPACE}k`],
    [12345, OwnerLocale.Japanese, '1.2万'],
    [12345, OwnerLocale.Korean, '1.2만'],
    [12345, OwnerLocale.ChineseSimplified, '1.2万'],
    [1234, OwnerLocale.Arabic, `1.2${NO_BREAK_SPACE}ألف`],
    [1234, OwnerLocale.Hindi, `1.2${NO_BREAK_SPACE}हज़ार`],
  ])('writes %s stars for %s as %s, in Latin digits', (count, locale, expected) => {
    expect(formatCompactCount({ count, locale })).toBe(expected);
  });
});

describe('pricingValuesOf', () => {
  it('gives the copy every number of the plans in the number format of the language', () => {
    expect(pricingValuesOf({ locale: OwnerLocale.EnglishUs })).toEqual({
      free: '5',
      included: '1,000',
      block: '1,000',
      price: '$9',
      overage: '$5',
    });
    expect(pricingValuesOf({ locale: OwnerLocale.PortugueseBrazil })).toEqual({
      free: '5',
      included: '1.000',
      block: '1.000',
      price: `R$${NO_BREAK_SPACE}49`,
      overage: `R$${NO_BREAK_SPACE}25`,
    });
  });
});
