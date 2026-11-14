import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { LegalDocument, legalPathOf } from '../../src/site/legal-links';
import { legalTextOf } from '../../src/site/legal-copy';
import { localePathOf } from '../../src/site/site-language';
import { languageOf } from '../../src/web-shell/locale-profiles';
import { SITE_ORIGIN, siteFetch } from '../support/site';

const HOME_TYPES = ['Organization', 'WebSite', 'WebApplication', 'FAQPage'];
const LEGAL_TYPES = ['Organization', 'WebSite', 'BreadcrumbList'];
const ALTERNATE_COUNT = Object.values(OwnerLocale).length + 1;
const PICKED_AGENT = Object.keys(AGENT_INSTALLS)[0]!;
const QUERY = `?agent=${PICKED_AGENT}&ref=abcdefgh2345`;
const LD_JSON_BLOCK = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/;
const HEADING = /<h([1-6])[\s>]/g;

type PageCase = { locale: OwnerLocale; document: LegalDocument | null; path: string; types: string[] };

const PAGES: PageCase[] = Object.values(OwnerLocale).flatMap((locale) => [
  { locale, document: null, path: localePathOf({ locale }), types: HOME_TYPES },
  ...Object.values(LegalDocument).map((document) => ({ locale, document, path: legalPathOf({ document, locale }), types: LEGAL_TYPES })),
]);

async function htmlOf(input: { path: string }): Promise<string> {
  const response = await siteFetch({ path: input.path });
  expect(response.status).toBe(200);
  return response.text();
}

function metaOf(input: { html: string; attribute: string; name: string }): string | undefined {
  return input.html.match(new RegExp(`<meta ${input.attribute}="${input.name}" content="([^"]*)"`))?.[1];
}

describe.each(PAGES)('the head and the body of $path', ({ locale, document, path, types }) => {
  it('names its language, canonical and every alternate', async () => {
    const html = await htmlOf({ path: `${path}${QUERY}` });
    expect(html).toContain(`<html lang="${languageOf({ locale })}"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${path === '/' ? '/' : path}"/>`);
    expect(html.match(/<link rel="alternate" hreflang="/g)).toHaveLength(ALTERNATE_COUNT);
    expect(html).toContain('hreflang="x-default"');
  });

  it('opens the social card with its own title, image and robots hints', async () => {
    const html = await htmlOf({ path });
    const ownTitle = document === null ? undefined : legalTextOf({ document, locale }).title;
    expect(metaOf({ html, attribute: 'property', name: 'og:image' })).toBe(`${SITE_ORIGIN}/site/og-${locale}.png`);
    expect(metaOf({ html, attribute: 'property', name: 'og:image:width' })).toBe('1200');
    expect(metaOf({ html, attribute: 'property', name: 'og:image:height' })).toBe('630');
    expect(metaOf({ html, attribute: 'property', name: 'og:image:type' })).toBe('image/png');
    expect(metaOf({ html, attribute: 'name', name: 'twitter:card' })).toBe('summary_large_image');
    expect(metaOf({ html, attribute: 'name', name: 'robots' })).toBe('index, follow, max-image-preview:large');
    if (ownTitle !== undefined) expect(metaOf({ html, attribute: 'property', name: 'og:title' })).toBe(ownTitle);
    expect(metaOf({ html, attribute: 'name', name: 'twitter:title' })).toBe(metaOf({ html, attribute: 'property', name: 'og:title' }));
  });

  it('has one h1 and headings that never skip a level', async () => {
    const levels = [...(await htmlOf({ path })).matchAll(HEADING)].map((match) => Number(match[1]));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, index) => expect(level).toBeLessThanOrEqual(levels[index]! + 1));
  });

  it('carries one JSON-LD graph that parses and is the only inline script', async () => {
    const html = await htmlOf({ path });
    const blocks = [...html.matchAll(LD_JSON_BLOCK)].map((match) => match[1]!);
    expect(blocks).toHaveLength(1);
    const data = JSON.parse(blocks[0]!);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual(types);
    expect(html).not.toMatch(INLINE_SCRIPT);
  });
});
