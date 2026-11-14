import { OwnerLocale } from '@zapbip/types';
import { LlmsFile, llmsPathOf } from './agentic-paths';
import { LegalDocument, legalUrlOf } from './legal-links';
import { AGENT_CRAWLER_NAMES, LEGAL_UPDATED_ON, SITE_UPDATED_ON } from './site-constants';
import { SitePath } from './site-paths';
import { canonicalUrlOf } from './site-links';
import { languageOf } from '../web-shell/locale-profiles';

const SITEMAP_NAMESPACES = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';
const DEFAULT_LANGUAGE_TAG = 'x-default';
const LLMS_DIRECTIVE = 'Llms-Txt';
const LLMS_FULL_DIRECTIVE = 'Llms-Full-Txt';

type LocalizedUrl = (locale: OwnerLocale) => string;
type SitemapPage = { urlOf: LocalizedUrl; lastModified: string };

function alternateOf(input: { hreflang: string; href: string }): string {
  return `    <xhtml:link rel="alternate" hreflang="${input.hreflang}" href="${input.href}"/>`;
}

function entriesOf(input: SitemapPage): string[] {
  const { urlOf, lastModified } = input;
  const alternates = [
    ...Object.values(OwnerLocale).map((locale) => alternateOf({ hreflang: languageOf({ locale }), href: urlOf(locale) })),
    alternateOf({ hreflang: DEFAULT_LANGUAGE_TAG, href: urlOf(OwnerLocale.EnglishUs) }),
  ];
  return Object.values(OwnerLocale).flatMap((locale) => [
    '  <url>',
    `    <loc>${urlOf(locale)}</loc>`,
    `    <lastmod>${lastModified}</lastmod>`,
    ...alternates,
    '  </url>',
  ]);
}

function crawlerGroupOf(input: { name: string }): string[] {
  return [`User-agent: ${input.name}`, 'Allow: /', ''];
}

function llmsLinesOf(input: { origin: string }): string[] {
  return Object.values(OwnerLocale).flatMap((locale) => [
    `${LLMS_DIRECTIVE}: ${input.origin}${llmsPathOf({ locale, file: LlmsFile.Summary })}`,
    `${LLMS_FULL_DIRECTIVE}: ${input.origin}${llmsPathOf({ locale, file: LlmsFile.Full })}`,
  ]);
}

export function renderRobots(input: { origin: string }): string {
  const crawlerGroups = ['*', ...AGENT_CRAWLER_NAMES].flatMap((name) => crawlerGroupOf({ name }));
  return [...crawlerGroups, ...llmsLinesOf({ origin: input.origin }), `Sitemap: ${input.origin}${SitePath.Sitemap}`, ''].join('\n');
}

export function renderSitemap(input: { origin: string }): string {
  const { origin } = input;
  const sitemapPages: SitemapPage[] = [
    { urlOf: (locale) => canonicalUrlOf({ origin, locale }), lastModified: SITE_UPDATED_ON },
    ...Object.values(LegalDocument).map((document): SitemapPage => ({
      urlOf: (locale) => legalUrlOf({ origin, document, locale }),
      lastModified: LEGAL_UPDATED_ON,
    })),
  ];
  const pages = sitemapPages.flatMap(entriesOf);
  return ['<?xml version="1.0" encoding="UTF-8"?>', `<urlset ${SITEMAP_NAMESPACES}>`, ...pages, '</urlset>', ''].join('\n');
}
