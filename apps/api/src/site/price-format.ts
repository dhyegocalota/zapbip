import type { OwnerLocale, PricingCurrency } from '@zapbip/types';

export function formatPrice(input: { cents: number; currency: PricingCurrency; locale: OwnerLocale }): string {
  throw new Error('formatPrice is not implemented');
}

export function formatCount(input: { count: number; locale: OwnerLocale }): string {
  throw new Error('formatCount is not implemented');
}

export function pricingValuesOf(input: { locale: OwnerLocale }): Record<string, string> {
  throw new Error('pricingValuesOf is not implemented');
}
