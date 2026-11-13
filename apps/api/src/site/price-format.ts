import {
  OwnerLocale,
  PRICING_CURRENCY_BY_LOCALE,
  PRICING_FREE_MESSAGES,
  PRICING_OVERAGE_BLOCK_MESSAGES,
  PRICING_OVERAGE_CENTS,
  PRICING_PRO_INCLUDED_MESSAGES,
  PRICING_PRO_MONTHLY_CENTS,
  type PricingCurrency,
} from '@zapbip/types';

const CENTS_PER_UNIT = 100;
const LANGUAGE_TAG_BY_LOCALE: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: 'en-US',
  [OwnerLocale.PortugueseBrazil]: 'pt-BR',
};

export function formatPrice(input: { cents: number; currency: PricingCurrency; locale: OwnerLocale }): string {
  const amount = input.cents / CENTS_PER_UNIT;
  const isWholeAmount = Number.isInteger(amount);
  return new Intl.NumberFormat(LANGUAGE_TAG_BY_LOCALE[input.locale], {
    style: 'currency',
    currency: input.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: isWholeAmount ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCount(input: { count: number; locale: OwnerLocale }): string {
  return new Intl.NumberFormat(LANGUAGE_TAG_BY_LOCALE[input.locale]).format(input.count);
}

export function pricingValuesOf(input: { locale: OwnerLocale }): Record<string, string> {
  const { locale } = input;
  const currency = PRICING_CURRENCY_BY_LOCALE[locale];
  return {
    free: formatCount({ count: PRICING_FREE_MESSAGES, locale }),
    included: formatCount({ count: PRICING_PRO_INCLUDED_MESSAGES, locale }),
    block: formatCount({ count: PRICING_OVERAGE_BLOCK_MESSAGES, locale }),
    price: formatPrice({ cents: PRICING_PRO_MONTHLY_CENTS[currency], currency, locale }),
    overage: formatPrice({ cents: PRICING_OVERAGE_CENTS[currency], currency, locale }),
  };
}
