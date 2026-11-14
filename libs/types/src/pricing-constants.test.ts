import { describe, expect, it } from 'vitest';
import {
  PRICING_CURRENCY_BY_LOCALE,
  PRICING_FREE_MESSAGES,
  PRICING_OVERAGE_BLOCK_MESSAGES,
  PRICING_OVERAGE_CENTS,
  PRICING_PRO_INCLUDED_MESSAGES,
  PRICING_PRO_MONTHLY_CENTS,
} from './constants';
import { PricingCurrency, WebLocale } from './enums';

describe('the pricing constants', () => {
  it('give the free plan five messages to try, once', () => {
    expect(PRICING_FREE_MESSAGES).toBe(5);
  });

  it('price Pro at 9 dollars or 49 reais a month with 1,000 messages included', () => {
    expect(PRICING_PRO_MONTHLY_CENTS).toEqual({ [PricingCurrency.Usd]: 900, [PricingCurrency.Brl]: 4900 });
    expect(PRICING_PRO_INCLUDED_MESSAGES).toBe(1000);
  });

  it('charge 5 dollars or 25 reais for each further 1,000 messages', () => {
    expect(PRICING_OVERAGE_CENTS).toEqual({ [PricingCurrency.Usd]: 500, [PricingCurrency.Brl]: 2500 });
    expect(PRICING_OVERAGE_BLOCK_MESSAGES).toBe(1000);
  });

  it('follow the language: Portuguese pays in reais and every other language in dollars', () => {
    expect(PRICING_CURRENCY_BY_LOCALE).toEqual({
      [WebLocale.EnglishUs]: PricingCurrency.Usd,
      [WebLocale.PortugueseBrazil]: PricingCurrency.Brl,
      [WebLocale.Spanish]: PricingCurrency.Usd,
      [WebLocale.German]: PricingCurrency.Usd,
      [WebLocale.French]: PricingCurrency.Usd,
      [WebLocale.Japanese]: PricingCurrency.Usd,
      [WebLocale.Korean]: PricingCurrency.Usd,
      [WebLocale.ChineseSimplified]: PricingCurrency.Usd,
    });
  });
});
