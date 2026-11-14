import { COMPANY, PRICING_CURRENCY_BY_LOCALE, PRICING_FREE_CENTS, type WebLocale } from '@zapbip/types';
import { faqItemsOf } from './faq-items';
import { legalTextOf } from './legal-copy';
import type { LegalDocument } from './legal-links';
import { heading, HeadingLevel, list, type MarkdownBlock, MarkdownBlockKind, paragraph, renderMarkdown } from './markdown-document';
import { formatPrice, pricingValuesOf } from './price-format';
import { FREE_FEATURE_KEYS } from './pricing-features';
import { quickStartEntriesOf } from './quick-start-entries';
import { setupPromptOf } from './setup-prompt';
import { leadingAgentNames } from './site-agents';
import { SITE_BRAND_SEPARATOR, SITE_EXAMPLE_CONNECTION_LINK } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';
import { SitePath } from './site-paths';

const CONTACT_PLACEHOLDER = '{contactEmail}';
const TITLE_SEPARATOR = ': ';
const SPACE = ' ';

type TitledCopy = { title: SiteCopyKey; body: SiteCopyKey };
type Text = (key: SiteCopyKey, extraValues?: Record<string, string>) => string;

const STORIES: TitledCopy[] = [
  { title: SiteCopyKey.WhyOfficialTitle, body: SiteCopyKey.WhyOfficialBody },
  { title: SiteCopyKey.WhyAskTitle, body: SiteCopyKey.WhyAskBody },
  { title: SiteCopyKey.WhyRoutingTitle, body: SiteCopyKey.WhyRoutingBody },
  { title: SiteCopyKey.WhyWakeTitle, body: SiteCopyKey.WhyWakeBody },
  { title: SiteCopyKey.WhyEveryAgentTitle, body: SiteCopyKey.WhyEveryAgentBody },
  { title: SiteCopyKey.WhyFastTitle, body: SiteCopyKey.WhyFastBody },
];
const STEPS: TitledCopy[] = [
  { title: SiteCopyKey.HowStepConnectTitle, body: SiteCopyKey.HowStepConnectBody },
  { title: SiteCopyKey.HowStepTextTitle, body: SiteCopyKey.HowStepTextBody },
  { title: SiteCopyKey.HowStepAnswerTitle, body: SiteCopyKey.HowStepAnswerBody },
];
const CAPABILITIES: TitledCopy[] = [
  { title: SiteCopyKey.CapabilityButtonsTitle, body: SiteCopyKey.CapabilityButtonsBody },
  { title: SiteCopyKey.CapabilityListTitle, body: SiteCopyKey.CapabilityListBody },
  { title: SiteCopyKey.CapabilityMediaTitle, body: SiteCopyKey.CapabilityMediaBody },
  { title: SiteCopyKey.CapabilityWakeTitle, body: SiteCopyKey.CapabilityWakeBody },
  { title: SiteCopyKey.CapabilityRoutingTitle, body: SiteCopyKey.CapabilityRoutingBody },
  { title: SiteCopyKey.CapabilityWaitTitle, body: SiteCopyKey.CapabilityWaitBody },
];
const GUARANTEES: TitledCopy[] = [
  { title: SiteCopyKey.PrivacyOfficialTitle, body: SiteCopyKey.PrivacyOfficialBody },
  { title: SiteCopyKey.PrivacyOnlyYouTitle, body: SiteCopyKey.PrivacyOnlyYouBody },
  { title: SiteCopyKey.PrivacyKeysTitle, body: SiteCopyKey.PrivacyKeysBody },
];

function withContact(input: { text: string }): string {
  return input.text.replaceAll(CONTACT_PLACEHOLDER, COMPANY.contactEmail);
}

function textOf(input: { locale: WebLocale; endpoint: string }): Text {
  const translate = copyOf({ locale: input.locale });
  const values = { ...pricingValuesOf({ locale: input.locale }), agents: leadingAgentNames(), endpoint: input.endpoint };
  return (key, extraValues) => withContact({ text: translate(key, { ...values, ...extraValues }) });
}

function titledBlocks(input: { text: Text; entries: TitledCopy[] }): MarkdownBlock[] {
  return input.entries.flatMap((entry) => [
    heading({ level: HeadingLevel.Item, text: input.text(entry.title) }),
    paragraph({ text: input.text(entry.body) }),
  ]);
}

function sectionHeading(input: { text: Text; key: SiteCopyKey }): MarkdownBlock {
  return heading({ level: HeadingLevel.Section, text: input.text(input.key) });
}

function heroBlocks(input: { text: Text }): MarkdownBlock[] {
  const { text } = input;
  return [
    paragraph({ text: `${text(SiteCopyKey.HeroTitleLead)}${SPACE}${text(SiteCopyKey.HeroTitleAccent)}` }),
    paragraph({ text: text(SiteCopyKey.HeroLead) }),
  ];
}

function quickStartBlocks(input: { text: Text; locale: WebLocale; origin: string }): MarkdownBlock[] {
  const { text, locale, origin } = input;
  const entries = quickStartEntriesOf({ locale, origin, connectionLink: SITE_EXAMPLE_CONNECTION_LINK }).flatMap(
    (entry): MarkdownBlock[] => [
      heading({ level: HeadingLevel.Item, text: entry.name }),
      paragraph({ text: entry.hint }),
      ...(entry.path.length === 0 ? [] : [list({ items: entry.path, isOrdered: true })]),
      { kind: MarkdownBlockKind.Code, language: '', code: entry.code },
    ],
  );
  return [
    sectionHeading({ text, key: SiteCopyKey.StartTitle }),
    paragraph({ text: text(SiteCopyKey.StartLead) }),
    paragraph({ text: setupPromptOf({ locale, origin }) }),
    ...entries,
    paragraph({ text: text(SiteCopyKey.StartExampleCaption) }),
    paragraph({ text: text(SiteCopyKey.StartNote) }),
  ];
}

function pricingBlocks(input: { text: Text; locale: WebLocale }): MarkdownBlock[] {
  const { text, locale } = input;
  const { price } = pricingValuesOf({ locale });
  const freePrice = formatPrice({ cents: PRICING_FREE_CENTS, currency: PRICING_CURRENCY_BY_LOCALE[locale], locale });
  return [
    sectionHeading({ text, key: SiteCopyKey.PricingTitle }),
    paragraph({ text: text(SiteCopyKey.PricingLead) }),
    heading({ level: HeadingLevel.Item, text: text(SiteCopyKey.PricingFreeName) }),
    paragraph({ text: `${freePrice}${SITE_BRAND_SEPARATOR}${text(SiteCopyKey.PricingFreeNote)}` }),
    list({ items: FREE_FEATURE_KEYS.map((key) => text(key)), isOrdered: false }),
    heading({ level: HeadingLevel.Item, text: text(SiteCopyKey.PricingProName) }),
    paragraph({ text: `${price}${text(SiteCopyKey.PricingProPeriod)}` }),
    list({ items: [text(SiteCopyKey.PricingProIncluded), text(SiteCopyKey.PricingProOverage)], isOrdered: false }),
    paragraph({ text: text(SiteCopyKey.PricingBilling) }),
    paragraph({ text: text(SiteCopyKey.PricingMessageDefinition) }),
  ];
}

function faqBlocks(input: { text: Text }): MarkdownBlock[] {
  const { text } = input;
  const items = faqItemsOf().flatMap((item) => [
    heading({ level: HeadingLevel.Item, text: text(item.question) }),
    paragraph({ text: text(item.answer) }),
  ]);
  return [sectionHeading({ text, key: SiteCopyKey.FaqTitle }), ...items];
}

export function homeMarkdownOf(input: { locale: WebLocale; origin: string }): string {
  const { locale, origin } = input;
  const text = textOf({ locale, endpoint: `${origin}${SitePath.RequestAccess}` });
  return renderMarkdown({
    blocks: [
      heading({ level: HeadingLevel.Page, text: text(SiteCopyKey.MetaOgTitle) }),
      { kind: MarkdownBlockKind.Quote, text: text(SiteCopyKey.MetaDescription) },
      ...heroBlocks({ text }),
      sectionHeading({ text, key: SiteCopyKey.WhyTitle }),
      ...titledBlocks({ text, entries: STORIES }),
      sectionHeading({ text, key: SiteCopyKey.HowTitle }),
      list({ items: STEPS.map((step) => `${text(step.title)}${TITLE_SEPARATOR}${text(step.body)}`), isOrdered: true }),
      sectionHeading({ text, key: SiteCopyKey.CapabilitiesTitle }),
      paragraph({ text: text(SiteCopyKey.CapabilitiesLead) }),
      ...titledBlocks({ text, entries: CAPABILITIES }),
      ...quickStartBlocks({ text, locale, origin }),
      ...pricingBlocks({ text, locale }),
      sectionHeading({ text, key: SiteCopyKey.PrivacyTitle }),
      ...titledBlocks({ text, entries: GUARANTEES }),
      heading({ level: HeadingLevel.Item, text: text(SiteCopyKey.PrivacyWaitlistTitle) }),
      paragraph({ text: text(SiteCopyKey.PrivacyWaitlistBody) }),
      ...faqBlocks({ text }),
      sectionHeading({ text, key: SiteCopyKey.AgentsTitle }),
      paragraph({ text: text(SiteCopyKey.AgentsBody) }),
      sectionHeading({ text, key: SiteCopyKey.FinalTitle }),
      paragraph({ text: text(SiteCopyKey.FinalBody) }),
    ],
  });
}

export function legalMarkdownOf(input: { document: LegalDocument; locale: WebLocale }): string {
  const legal = legalTextOf(input);
  const sections = legal.sections.flatMap((section): MarkdownBlock[] => [
    heading({ level: HeadingLevel.Section, text: section.heading }),
    ...section.paragraphs.map((text) => paragraph({ text: withContact({ text }) })),
    ...(section.items.length === 0 ? [] : [list({ items: section.items.map((text) => withContact({ text })), isOrdered: false })]),
  ]);
  return renderMarkdown({
    blocks: [
      heading({ level: HeadingLevel.Page, text: legal.title }),
      paragraph({ text: legal.updated }),
      { kind: MarkdownBlockKind.Quote, text: legal.summary },
      ...sections,
    ],
  });
}
