import { COMPANY, PRICING_CURRENCY_BY_LOCALE, PRICING_FREE_CENTS, PRICING_PRO_MONTHLY_CENTS, type OwnerLocale } from '@zapbip/types';
import { languageOf } from '../web-shell/locale-profiles';
import { aboutFactsOf } from './about-facts';
import { faqItemsOf } from './faq-items';
import { legalTextOf } from './legal-copy';
import type { LegalDocument } from './legal-links';
import type { PageModel } from './page-model';
import { plainContactTextOf } from './plain-contact-text';
import { pricingValuesOf } from './price-format';
import { PRICING_FRAGMENT, REPOSITORY_URL, SOURCE_LICENSE_URL } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';
import { canonicalUrlOf, pageUrlOf } from './site-links';
import { APPLE_TOUCH_ICON_PATH } from './site-paths';

export type StructuredDataNode = Record<string, unknown>;
export type StructuredData = { '@context': string; '@graph': StructuredDataNode[] };

enum SchemaType {
  Organization = 'Organization',
  WebSite = 'WebSite',
  WebApplication = 'WebApplication',
  SoftwareSourceCode = 'SoftwareSourceCode',
  FaqPage = 'FAQPage',
  Question = 'Question',
  Answer = 'Answer',
  BreadcrumbList = 'BreadcrumbList',
  ListItem = 'ListItem',
  Offer = 'Offer',
}

const SCHEMA_CONTEXT = 'https://schema.org';
const PRE_ORDER_AVAILABILITY = 'https://schema.org/PreOrder';
const APPLICATION_CATEGORY = 'DeveloperApplication';
const OPERATING_SYSTEM = 'Web';
const PROGRAMMING_LANGUAGE = 'TypeScript';
const CENTS_PER_UNIT = 100;
const PRICE_FRACTION_DIGITS = 2;
const FIRST_POSITION = 1;
const ESCAPED_CHARACTERS: Record<string, string> = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' };
const ESCAPED_PATTERN = /[<>&]/g;

function idOf(input: { origin: string; fragment: string }): { '@id': string } {
  return { '@id': `${input.origin}/#${input.fragment}` };
}

function organizationOf(input: { origin: string }): StructuredDataNode {
  return {
    '@type': SchemaType.Organization,
    ...idOf({ origin: input.origin, fragment: 'organization' }),
    name: COMPANY.tradeName,
    url: COMPANY.website,
    logo: `${input.origin}${APPLE_TOUCH_ICON_PATH}`,
  };
}

function websiteOf(input: { model: PageModel }): StructuredDataNode {
  const { model } = input;
  return {
    '@type': SchemaType.WebSite,
    ...idOf({ origin: model.siteOrigin, fragment: 'website' }),
    name: copyOf({ locale: model.locale })(SiteCopyKey.BrandName),
    url: canonicalUrlOf({ origin: model.siteOrigin, locale: model.locale }),
    inLanguage: languageOf({ locale: model.locale }),
    publisher: idOf({ origin: model.siteOrigin, fragment: 'organization' }),
  };
}

function priceOf(input: { cents: number }): string {
  return (input.cents / CENTS_PER_UNIT).toFixed(PRICE_FRACTION_DIGITS);
}

function offerOf(input: { model: PageModel; name: SiteCopyKey; cents: number }): StructuredDataNode {
  const { model, name, cents } = input;
  return {
    '@type': SchemaType.Offer,
    name: copyOf({ locale: model.locale })(name),
    price: priceOf({ cents }),
    priceCurrency: PRICING_CURRENCY_BY_LOCALE[model.locale],
    availability: PRE_ORDER_AVAILABILITY,
    url: `${canonicalUrlOf({ origin: model.siteOrigin, locale: model.locale })}${PRICING_FRAGMENT}`,
  };
}

function applicationOf(input: { model: PageModel }): StructuredDataNode {
  const { model } = input;
  const currency = PRICING_CURRENCY_BY_LOCALE[model.locale];
  return {
    '@type': SchemaType.WebApplication,
    ...idOf({ origin: model.siteOrigin, fragment: 'application' }),
    name: copyOf({ locale: model.locale })(SiteCopyKey.BrandName),
    url: canonicalUrlOf({ origin: model.siteOrigin, locale: model.locale }),
    description: aboutFactsOf({ locale: model.locale }).definition,
    applicationCategory: APPLICATION_CATEGORY,
    operatingSystem: OPERATING_SYSTEM,
    inLanguage: languageOf({ locale: model.locale }),
    publisher: idOf({ origin: model.siteOrigin, fragment: 'organization' }),
    offers: [
      offerOf({ model, name: SiteCopyKey.PricingFreeName, cents: PRICING_FREE_CENTS }),
      offerOf({ model, name: SiteCopyKey.PricingProName, cents: PRICING_PRO_MONTHLY_CENTS[currency] }),
    ],
  };
}

function sourceCodeOf(input: { model: PageModel }): StructuredDataNode {
  const { model } = input;
  return {
    '@type': SchemaType.SoftwareSourceCode,
    ...idOf({ origin: model.siteOrigin, fragment: 'source' }),
    name: copyOf({ locale: model.locale })(SiteCopyKey.BrandName),
    codeRepository: REPOSITORY_URL,
    license: SOURCE_LICENSE_URL,
    isAccessibleForFree: true,
    programmingLanguage: PROGRAMMING_LANGUAGE,
    targetProduct: idOf({ origin: model.siteOrigin, fragment: 'application' }),
    publisher: idOf({ origin: model.siteOrigin, fragment: 'organization' }),
  };
}

function faqPageOf(input: { locale: OwnerLocale }): StructuredDataNode {
  const translate = copyOf({ locale: input.locale });
  const values = pricingValuesOf({ locale: input.locale });
  return {
    '@type': SchemaType.FaqPage,
    mainEntity: faqItemsOf().map((item) => ({
      '@type': SchemaType.Question,
      name: translate(item.question),
      acceptedAnswer: { '@type': SchemaType.Answer, text: plainContactTextOf({ text: translate(item.answer, values) }) },
    })),
  };
}

function breadcrumbOf(input: { model: PageModel; document: LegalDocument }): StructuredDataNode {
  const { model, document } = input;
  const items = [
    {
      name: copyOf({ locale: model.locale })(SiteCopyKey.BrandName),
      item: canonicalUrlOf({ origin: model.siteOrigin, locale: model.locale }),
    },
    { name: legalTextOf({ document, locale: model.locale }).title, item: pageUrlOf({ model, locale: model.locale }) },
  ];
  return {
    '@type': SchemaType.BreadcrumbList,
    itemListElement: items.map((entry, index) => ({ '@type': SchemaType.ListItem, position: FIRST_POSITION + index, ...entry })),
  };
}

function graphOf(input: { nodes: StructuredDataNode[] }): StructuredData {
  return { '@context': SCHEMA_CONTEXT, '@graph': input.nodes };
}

export function structuredDataOf(input: { model: PageModel }): StructuredData {
  const { model } = input;
  const common = [organizationOf({ origin: model.siteOrigin }), websiteOf({ model })];
  if (model.legalDocument === null)
    return graphOf({ nodes: [...common, applicationOf({ model }), sourceCodeOf({ model }), faqPageOf({ locale: model.locale })] });
  return graphOf({ nodes: [...common, breadcrumbOf({ model, document: model.legalDocument })] });
}

export function serializeStructuredData(input: { data: StructuredData }): string {
  return JSON.stringify(input.data).replace(ESCAPED_PATTERN, (character) => ESCAPED_CHARACTERS[character]!);
}
