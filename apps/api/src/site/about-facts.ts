import type { WebLocale } from '@zapbip/types';

export type AboutFacts = { title: string; definition: string; lines: string[] };

export function aboutFactsOf(input: { locale: WebLocale }): AboutFacts {
  throw new Error('aboutFactsOf is not implemented');
}
