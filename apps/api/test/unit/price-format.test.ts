import { WebLocale, PricingCurrency } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { formatCount, formatPrice, pricingValuesOf } from '../../src/site/price-format';

const NO_BREAK_SPACE = ' ';

describe('formatPrice', () => {
  it.each([
    [0, PricingCurrency.Usd, WebLocale.EnglishUs, '$0'],
    [900, PricingCurrency.Usd, WebLocale.EnglishUs, '$9'],
    [500, PricingCurrency.Usd, WebLocale.EnglishUs, '$5'],
    [0, PricingCurrency.Brl, WebLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}0`],
    [4900, PricingCurrency.Brl, WebLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}49`],
    [2500, PricingCurrency.Brl, WebLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}25`],
    [1250, PricingCurrency.Usd, WebLocale.EnglishUs, '$12.50'],
    [1250, PricingCurrency.Brl, WebLocale.PortugueseBrazil, `R$${NO_BREAK_SPACE}12,50`],
  ])('writes %s cents in %s for %s as %s', (cents, currency, locale, expected) => {
    expect(formatPrice({ cents, currency, locale })).toBe(expected);
  });
});

describe('formatCount', () => {
  it.each([
    [5, WebLocale.EnglishUs, '5'],
    [1000, WebLocale.EnglishUs, '1,000'],
    [1000, WebLocale.PortugueseBrazil, '1.000'],
  ])('writes %s for %s as %s', (count, locale, expected) => {
    expect(formatCount({ count, locale })).toBe(expected);
  });
});

describe('pricingValuesOf', () => {
  it('gives the copy every number of the plans in the number format of the language', () => {
    expect(pricingValuesOf({ locale: WebLocale.EnglishUs })).toEqual({
      free: '5',
      included: '1,000',
      block: '1,000',
      price: '$9',
      overage: '$5',
    });
    expect(pricingValuesOf({ locale: WebLocale.PortugueseBrazil })).toEqual({
      free: '5',
      included: '1.000',
      block: '1.000',
      price: `R$${NO_BREAK_SPACE}49`,
      overage: `R$${NO_BREAK_SPACE}25`,
    });
  });
});
