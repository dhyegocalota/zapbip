import { PRICING_FREE_MESSAGES, WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { aboutFactsOf } from '../../src/site/about-facts';
import { llmsFullTextOf, llmsTextOf } from '../../src/site/llms-files';
import { homeMarkdownOf } from '../../src/site/markdown-pages';
import { formatCount, pricingValuesOf } from '../../src/site/price-format';
import { siteAgentNames } from '../../src/site/site-agents';
import { SITE_UPDATED_ON } from '../../src/site/site-constants';
import { structuredDataOf } from '../../src/site/structured-data';
import { MODEL_ORIGIN, pageModelFor } from '../support/page-model';

describe.each(Object.values(WebLocale))('the About facts in %s', (locale) => {
  const facts = aboutFactsOf({ locale });
  const values = pricingValuesOf({ locale });

  it('state the price, the free messages, every supported agent and the date', () => {
    const text = facts.lines.join('\n');
    expect(text).toContain(values.price);
    expect(text).toContain(values.overage);
    expect(text).toContain(formatCount({ count: PRICING_FREE_MESSAGES, locale }));
    siteAgentNames().forEach((name) => expect(text).toContain(name));
    expect(text).toContain(SITE_UPDATED_ON);
  });

  it('open the home Markdown twin, llms.txt and llms-full.txt with the same words', () => {
    const outputs = [
      homeMarkdownOf({ locale, origin: MODEL_ORIGIN }),
      llmsTextOf({ origin: MODEL_ORIGIN, locale }),
      llmsFullTextOf({ origin: MODEL_ORIGIN, locale }),
    ];
    outputs.forEach((output) => {
      expect(output).toContain(facts.title);
      expect(output).toContain(facts.definition);
      facts.lines.forEach((line) => expect(output).toContain(line));
    });
  });

  it('give the application of the JSON-LD the same definition', () => {
    const graph = structuredDataOf({ model: pageModelFor({ locale, legalDocument: null }) })['@graph'];
    expect(graph.find((node) => node['@type'] === 'WebApplication')?.description).toBe(facts.definition);
  });

  it('keep the definition to one sentence', () => {
    expect(facts.definition.split(/[.。]\s*/).filter((part) => part.length > 0)).toHaveLength(1);
  });
});
