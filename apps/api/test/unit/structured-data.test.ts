import { COMPANY, PRICING_CURRENCY_BY_LOCALE, PRICING_FREE_CENTS, PRICING_PRO_MONTHLY_CENTS, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { aboutFactsOf } from '../../src/site/about-facts';
import { faqItemsOf } from '../../src/site/faq-items';
import { LegalDocument, legalUrlOf } from '../../src/site/legal-links';
import { legalTextOf } from '../../src/site/legal-copy';
import { pricingValuesOf } from '../../src/site/price-format';
import { canonicalUrlOf } from '../../src/site/site-links';
import { REPOSITORY_URL } from '../../src/site/site-constants';
import { SiteCopyKey } from '../../src/site/site-copy';
import { copyOf } from '../../src/site/site-copy-text';
import { serializeStructuredData, structuredDataOf, type StructuredDataNode } from '../../src/site/structured-data';
import { languageOf } from '../../src/web-shell/locale-profiles';
import { MODEL_ORIGIN, pageModelFor } from '../support/page-model';

const CENTS_PER_UNIT = 100;

function graphOf(input: { locale: OwnerLocale; document: LegalDocument | null }): StructuredDataNode[] {
  return structuredDataOf({ model: pageModelFor({ locale: input.locale, legalDocument: input.document }) })['@graph'];
}

function nodeOf(input: { graph: StructuredDataNode[]; type: string }): StructuredDataNode {
  const node = input.graph.find((candidate) => candidate['@type'] === input.type);
  if (node === undefined) throw new Error(`no ${input.type} node`);
  return node;
}

function typesOf(input: { graph: StructuredDataNode[] }): unknown[] {
  return input.graph.map((node) => node['@type']);
}

describe.each(Object.values(OwnerLocale))('structured data of the home page in %s', (locale) => {
  const graph = graphOf({ locale, document: null });
  const translate = copyOf({ locale });

  it('holds the organization, the site, the application and the questions', () => {
    expect(typesOf({ graph })).toEqual(['Organization', 'WebSite', 'WebApplication', 'FAQPage']);
  });

  it('describes the organization with its name, address, logo and repository', () => {
    const organization = nodeOf({ graph, type: 'Organization' });
    expect(organization).toMatchObject({
      '@id': `${MODEL_ORIGIN}/#organization`,
      name: COMPANY.tradeName,
      url: COMPANY.website,
      logo: `${MODEL_ORIGIN}/site/apple-touch-icon.png`,
    });
    expect(organization.sameAs).toContain(REPOSITORY_URL);
  });

  it('describes the website in the page language, published by the organization', () => {
    expect(nodeOf({ graph, type: 'WebSite' })).toMatchObject({
      name: translate(SiteCopyKey.BrandName),
      url: canonicalUrlOf({ origin: MODEL_ORIGIN, locale }),
      inLanguage: languageOf({ locale }),
      publisher: { '@id': `${MODEL_ORIGIN}/#organization` },
    });
  });

  it('describes the application with the canonical definition and a free and a Pro offer in the page currency', () => {
    const currency = PRICING_CURRENCY_BY_LOCALE[locale];
    const application = nodeOf({ graph, type: 'WebApplication' });
    expect(application).toMatchObject({
      name: translate(SiteCopyKey.BrandName),
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description: aboutFactsOf({ locale }).definition,
      inLanguage: languageOf({ locale }),
    });
    expect(application.offers).toEqual([
      expect.objectContaining({
        '@type': 'Offer',
        name: translate(SiteCopyKey.PricingFreeName),
        price: (PRICING_FREE_CENTS / CENTS_PER_UNIT).toFixed(2),
        priceCurrency: currency,
      }),
      expect.objectContaining({
        '@type': 'Offer',
        name: translate(SiteCopyKey.PricingProName),
        price: (PRICING_PRO_MONTHLY_CENTS[currency] / CENTS_PER_UNIT).toFixed(2),
        priceCurrency: currency,
      }),
    ]);
  });

  it('repeats the visible questions and answers word for word', () => {
    const values = { ...pricingValuesOf({ locale }) };
    const expected = faqItemsOf().map((item) => ({
      '@type': 'Question',
      name: translate(item.question),
      acceptedAnswer: { '@type': 'Answer', text: translate(item.answer, values).replaceAll('{contactEmail}', COMPANY.contactEmail) },
    }));
    expect(nodeOf({ graph, type: 'FAQPage' }).mainEntity).toEqual(expected);
  });
});

describe.each(Object.values(OwnerLocale))('structured data of the legal pages in %s', (locale) => {
  it.each(Object.values(LegalDocument))('puts the %s page under the home page in a breadcrumb', (document) => {
    const graph = graphOf({ locale, document });
    expect(typesOf({ graph })).toEqual(['Organization', 'WebSite', 'BreadcrumbList']);
    expect(nodeOf({ graph, type: 'BreadcrumbList' }).itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: copyOf({ locale })(SiteCopyKey.BrandName),
        item: canonicalUrlOf({ origin: MODEL_ORIGIN, locale }),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: legalTextOf({ document, locale }).title,
        item: legalUrlOf({ origin: MODEL_ORIGIN, document, locale }),
      },
    ]);
  });
});

describe('serializeStructuredData', () => {
  it('escapes the characters that could end the data block', () => {
    const text = serializeStructuredData({ data: { '@context': 'https://schema.org', '@graph': [{ name: '</script><b>&' }] } });
    expect(text).not.toMatch(/[<>&]/);
    expect(JSON.parse(text)['@graph'][0].name).toBe('</script><b>&');
  });
});
