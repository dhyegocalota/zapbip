import type { OwnerLocale } from '@zapbip/types';

export function renderStartUnavailablePage(input: { locale: OwnerLocale }): string {
  throw new Error(`renderStartUnavailablePage is not implemented for ${input.locale}`);
}
