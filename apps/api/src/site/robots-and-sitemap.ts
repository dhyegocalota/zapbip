import { WebLocale } from '@zapbip/types';
import { LegalDocument, legalUrlOf } from './legal-links';
import { SitePath } from './site-paths';
import { canonicalUrlOf } from './site-links';
import { languageOf } from '../web-shell/locale-profiles';

const SITEMAP_NAMESPACES = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';
const DEFAULT_LANGUAGE_TAG = 'x-default';

type LocalizedUrl = (locale: WebLocale) => string;

function alternateOf(input: { hreflang: string; href: string }): string {
  return `    <xhtml:link rel="alternate" hreflang="${input.hreflang}" href="${input.href}"/>`;
}

function entriesOf(input: { urlOf: LocalizedUrl }): string[] {
  const { urlOf } = input;
  const alternates = [
    ...Object.values(WebLocale).map((locale) => alternateOf({ hreflang: languageOf({ locale }), href: urlOf(locale) })),
    alternateOf({ hreflang: DEFAULT_LANGUAGE_TAG, href: urlOf(WebLocale.EnglishUs) }),
  ];
  return Object.values(WebLocale).flatMap((locale) => ['  <url>', `    <loc>${urlOf(locale)}</loc>`, ...alternates, '  </url>']);
}

export function renderRobots(input: { origin: string }): string {
  return ['User-agent: *', 'Allow: /', `Sitemap: ${input.origin}${SitePath.Sitemap}`, ''].join('\n');
}

export function renderSitemap(input: { origin: string }): string {
  const { origin } = input;
  const localizedUrls: LocalizedUrl[] = [
    (locale) => canonicalUrlOf({ origin, locale }),
    ...Object.values(LegalDocument).map(
      (document): LocalizedUrl =>
        (locale) =>
          legalUrlOf({ origin, document, locale }),
    ),
  ];
  const pages = localizedUrls.flatMap((urlOf) => entriesOf({ urlOf }));
  return ['<?xml version="1.0" encoding="UTF-8"?>', `<urlset ${SITEMAP_NAMESPACES}>`, ...pages, '</urlset>', ''].join('\n');
}
