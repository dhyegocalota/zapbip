import { MEDIA_RETENTION_MS, QUEUE_RETENTION_MS } from '@zapbip/core';
import type { OwnerLocale } from '@zapbip/types';
import { daysOf } from './legal-copy';
import { heading, HeadingLevel, list, type MarkdownBlock, paragraph } from './markdown-document';
import { pricingValuesOf } from './price-format';
import { allAgentNames } from './site-agents';
import { REPOSITORY_URL, SITE_UPDATED_ON } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';

export type AboutFacts = { title: string; definition: string; lines: string[] };

const LINE_KEYS = [
  SiteCopyKey.AboutPricing,
  SiteCopyKey.AboutAgents,
  SiteCopyKey.AboutLimits,
  SiteCopyKey.AboutSource,
  SiteCopyKey.AboutUpdated,
];

export function aboutFactsOf(input: { locale: OwnerLocale }): AboutFacts {
  const { locale } = input;
  const translate = copyOf({ locale });
  const values = {
    ...pricingValuesOf({ locale }),
    agents: allAgentNames({ locale }),
    messageDays: daysOf({ milliseconds: QUEUE_RETENTION_MS, locale }),
    mediaDays: daysOf({ milliseconds: MEDIA_RETENTION_MS, locale }),
    updatedOn: SITE_UPDATED_ON,
    repository: REPOSITORY_URL,
  };
  return {
    title: translate(SiteCopyKey.AboutTitle),
    definition: translate(SiteCopyKey.AboutDefinition),
    lines: LINE_KEYS.map((key) => translate(key, values)),
  };
}

export function aboutBlocksOf(input: { locale: OwnerLocale }): MarkdownBlock[] {
  const facts = aboutFactsOf(input);
  return [
    heading({ level: HeadingLevel.Section, text: facts.title }),
    paragraph({ text: facts.definition }),
    list({ items: facts.lines, isOrdered: false }),
  ];
}
