import { SitePath } from './site-paths';
import { SITE_LANGUAGE_PARAMETER } from './site-constants';
import { DocsLanguage } from '@zapbip/types';

const SITEMAP_NAMESPACES = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';
const DEFAULT_LANGUAGE_TAG = 'x-default';

function alternateOf(input: { hreflang: string; href: string }): string {
  return `    <xhtml:link rel="alternate" hreflang="${input.hreflang}" href="${input.href}"/>`;
}

export function renderRobots(input: { origin: string }): string {
  return ['User-agent: *', 'Allow: /', `Sitemap: ${input.origin}${SitePath.Sitemap}`, ''].join('\n');
}

export function renderSitemap(input: { origin: string }): string {
  const canonical = `${input.origin}${SitePath.Home}`;
  const alternates = [
    ...Object.values(DocsLanguage).map((language) =>
      alternateOf({ hreflang: language, href: `${canonical}?${SITE_LANGUAGE_PARAMETER}=${language}` }),
    ),
    alternateOf({ hreflang: DEFAULT_LANGUAGE_TAG, href: canonical }),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset ${SITEMAP_NAMESPACES}>`,
    '  <url>',
    `    <loc>${canonical}</loc>`,
    ...alternates,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}
