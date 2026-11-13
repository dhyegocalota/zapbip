import { OwnerLocale } from '@zapbip/types';
import { SitePath } from './site-paths';
import { languageOf, canonicalUrlOf } from './site-links';

const SITEMAP_NAMESPACES = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';
const DEFAULT_LANGUAGE_TAG = 'x-default';

function alternateOf(input: { hreflang: string; href: string }): string {
  return `    <xhtml:link rel="alternate" hreflang="${input.hreflang}" href="${input.href}"/>`;
}

export function renderRobots(input: { origin: string }): string {
  return ['User-agent: *', 'Allow: /', `Sitemap: ${input.origin}${SitePath.Sitemap}`, ''].join('\n');
}

export function renderSitemap(input: { origin: string }): string {
  const { origin } = input;
  const alternates = [
    ...Object.values(OwnerLocale).map((locale) =>
      alternateOf({ hreflang: languageOf({ locale }), href: canonicalUrlOf({ origin, locale }) }),
    ),
    alternateOf({ hreflang: DEFAULT_LANGUAGE_TAG, href: canonicalUrlOf({ origin, locale: OwnerLocale.EnglishUs }) }),
  ];
  const pages = Object.values(OwnerLocale).flatMap((locale) => [
    '  <url>',
    `    <loc>${canonicalUrlOf({ origin, locale })}</loc>`,
    ...alternates,
    '  </url>',
  ]);
  return ['<?xml version="1.0" encoding="UTF-8"?>', `<urlset ${SITEMAP_NAMESPACES}>`, ...pages, '</urlset>', ''].join('\n');
}
