import { reset } from 'cloudflare:test';
import { COMPANY, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LegalDocument } from '../../src/site/legal-links';
import { legalTextOf } from '../../src/site/legal-copy';
import { pricingValuesOf } from '../../src/site/price-format';
import { leadingAgentNames, siteAgents, siteQuickStartOf } from '../../src/site/site-agents';
import { SITE_EXAMPLE_CONNECTION_LINK } from '../../src/site/site-constants';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { localePathOf } from '../../src/site/site-language';
import { applyLandingWaitlistMigration } from '../support/seed';
import { copyHtml, SITE_ORIGIN, siteFetch } from '../support/site';

const MARKDOWN_TYPE = 'text/markdown; charset=utf-8';
const TEXT_TYPE = 'text/plain; charset=utf-8';
const MARKDOWN_ACCEPT = 'text/markdown, text/html;q=0.8';
const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const HOME_TWINS = [
  ['/index.md', OwnerLocale.EnglishUs],
  ['/pt-br.md', OwnerLocale.PortugueseBrazil],
] as const;
const LEGAL_TWINS = [
  ['/terms.md', LegalDocument.Terms, OwnerLocale.EnglishUs],
  ['/privacy.md', LegalDocument.Privacy, OwnerLocale.EnglishUs],
  ['/pt-br/termos.md', LegalDocument.Terms, OwnerLocale.PortugueseBrazil],
  ['/pt-br/privacidade.md', LegalDocument.Privacy, OwnerLocale.PortugueseBrazil],
] as const;
const HTML_PAGES = [
  ['/', '/index.md'],
  ['/pt-br', '/pt-br.md'],
  ['/terms', '/terms.md'],
  ['/privacy', '/privacy.md'],
  ['/pt-br/termos', '/pt-br/termos.md'],
  ['/pt-br/privacidade', '/pt-br/privacidade.md'],
] as const;

function copy(input: { key: SiteCopyKey; locale: OwnerLocale; values?: Record<string, string> }): string {
  return renderSiteCopy(input);
}

async function textOf(input: { path: string; headers?: Record<string, string> }): Promise<{ response: Response; text: string }> {
  const response = await siteFetch(input);
  return { response, text: await response.text() };
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the Markdown twins of the home pages', () => {
  it.each(HOME_TWINS)('%s answers Markdown rendered from the copy', async (path, locale) => {
    const { response, text } = await textOf({ path });
    const values = pricingValuesOf({ locale });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(MARKDOWN_TYPE);
    expect(text.startsWith(`# ${copy({ key: SiteCopyKey.MetaOgTitle, locale })}\n`)).toBe(true);
    [SiteCopyKey.WhyTitle, SiteCopyKey.HowTitle, SiteCopyKey.StartTitle, SiteCopyKey.PricingTitle, SiteCopyKey.FaqTitle].forEach((key) =>
      expect(text).toContain(`## ${copy({ key, locale })}`),
    );
    expect(text).toContain(copy({ key: SiteCopyKey.PricingFreeNote, locale, values }));
    expect(text).toContain(copy({ key: SiteCopyKey.PricingProIncluded, locale, values }));
    expect(text).toContain(copy({ key: SiteCopyKey.FaqDataQuestion, locale }));
  });

  it.each(HOME_TWINS)('%s carries the quick start of every agent with its code', async (path, locale) => {
    const { text } = await textOf({ path });
    siteAgents().forEach((agent) => {
      const { code } = siteQuickStartOf({ id: agent.id, locale, connectionLink: SITE_EXAMPLE_CONNECTION_LINK });
      expect(text).toContain(`### ${agent.name}`);
      expect(text).toContain(code);
    });
  });

  it.each(HOME_TWINS)('%s tells an agent how to request access', async (path, locale) => {
    const { text } = await textOf({ path });
    expect(text).toContain(`${SITE_ORIGIN}/api/request-access`);
    expect(text).toContain(copy({ key: SiteCopyKey.AgentsTitle, locale }));
  });

  it('keeps answering Markdown with a referral query', async () => {
    const { response } = await textOf({ path: '/index.md?ref=abcdefgh2345' });
    expect(response.headers.get('content-type')).toBe(MARKDOWN_TYPE);
  });
});

describe('the agents section of the page', () => {
  it.each([
    ['/', OwnerLocale.EnglishUs],
    ['/pt-br', OwnerLocale.PortugueseBrazil],
  ] as const)('%s shows the same title and body as its Markdown twin', async (path, locale) => {
    const { text } = await textOf({ path });
    const endpoint = `${SITE_ORIGIN}/api/request-access`;
    expect(text).toContain('id="agents"');
    expect(text).toContain(copyHtml({ key: SiteCopyKey.AgentsTitle, locale }));
    expect(text).toContain(copyHtml({ key: SiteCopyKey.AgentsBody, locale, values: { endpoint } }));
  });
});

describe('the Markdown twins keep up with the page copy', () => {
  const SECTION_KEY_PATTERN = /^(Why|HowStep|Capability|Privacy)\w*(Title|Body)$|^Faq(?!Referral)\w*(Question|Answer)$/;
  const sectionKeys = Object.entries(SiteCopyKey)
    .filter(([name]) => SECTION_KEY_PATTERN.test(name))
    .map(([, key]) => key);

  it.each(HOME_TWINS)('%s holds every title, body, question and answer of the sections', async (path, locale) => {
    const { text } = await textOf({ path });
    const values = { ...pricingValuesOf({ locale }), agents: leadingAgentNames({ locale }) };
    sectionKeys.forEach((key) => expect(text).toContain(copy({ key, locale, values }).replaceAll('{contactEmail}', COMPANY.contactEmail)));
  });
});

describe('the Markdown twins of the legal pages', () => {
  it.each(LEGAL_TWINS)('%s carries the title, the summary and every section', async (path, document, locale) => {
    const { response, text } = await textOf({ path });
    const legal = legalTextOf({ document, locale });
    expect(response.headers.get('content-type')).toBe(MARKDOWN_TYPE);
    expect(text.startsWith(`# ${legal.title}\n`)).toBe(true);
    expect(text).toContain(legal.summary);
    legal.sections.forEach((section) => expect(text).toContain(`## ${section.heading}`));
  });
});

describe('content negotiation', () => {
  it.each(HTML_PAGES)('%s answers its twin to an Accept that prefers Markdown', async (path, twin) => {
    const negotiated = await textOf({ path, headers: { accept: MARKDOWN_ACCEPT } });
    const direct = await textOf({ path: twin });
    expect(negotiated.response.headers.get('content-type')).toBe(MARKDOWN_TYPE);
    expect(negotiated.text).toBe(direct.text);
  });

  it.each([BROWSER_ACCEPT, '*/*', 'text/html', 'text/markdown;q=0.1, text/html;q=0.9'])('answers HTML to %s', async (accept) => {
    const { response } = await textOf({ path: '/', headers: { accept } });
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('answers HTML when there is no Accept header', async () => {
    const { response } = await textOf({ path: '/terms' });
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it.each([
    ['/', MARKDOWN_ACCEPT],
    ['/', BROWSER_ACCEPT],
    ['/index.md', BROWSER_ACCEPT],
  ])('varies %s on Accept for %s', async (path, accept) => {
    const { response } = await textOf({ path, headers: { accept } });
    const vary = response.headers
      .get('vary')!
      .split(',')
      .map((name) => name.trim().toLowerCase());
    expect(vary).toContain('accept');
  });

  it('does not turn an unknown path into Markdown', async () => {
    const { response } = await textOf({ path: '/nowhere', headers: { accept: MARKDOWN_ACCEPT } });
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/html');
  });
});

describe('the head of every page', () => {
  it.each(HTML_PAGES)('%s names its Markdown twin', async (path, twin) => {
    const { text } = await textOf({ path });
    expect(text).toContain(`<link rel="alternate" type="text/markdown" href="${SITE_ORIGIN}${twin}"/>`);
  });

  it('names no twin on the not found page', async () => {
    const { text } = await textOf({ path: '/nowhere' });
    expect(text).not.toContain('text/markdown');
  });
});

describe('llms.txt', () => {
  it.each([
    ['/llms.txt', OwnerLocale.EnglishUs, '/terms.md'],
    ['/pt-br/llms.txt', OwnerLocale.PortugueseBrazil, '/pt-br/termos.md'],
  ])('%s follows the llms.txt format', async (path, locale, termsTwin) => {
    const { response, text } = await textOf({ path });
    expect(response.headers.get('content-type')).toBe(TEXT_TYPE);
    expect(text.startsWith('# zapbip\n\n> ')).toBe(true);
    expect(text).toContain(`${SITE_ORIGIN}${locale === OwnerLocale.EnglishUs ? '/index.md' : '/pt-br.md'}`);
    expect(text).toContain(`${SITE_ORIGIN}${termsTwin}`);
    expect(text).toContain(`${SITE_ORIGIN}/api/request-access`);
    expect(text).toContain('https://docs.zapbip.com/llms.txt');
    expect(text).toContain('https://docs.zapbip.com/llms-full.txt');
    expect(text).toContain('https://docs.zapbip.com/mcp');
    expect(text.match(/^## /gm)!.length).toBeGreaterThanOrEqual(3);
  });

  it('answers the language of its path', async () => {
    const english = await textOf({ path: '/llms.txt' });
    const portuguese = await textOf({ path: '/pt-br/llms.txt' });
    expect(english.text).toContain(copy({ key: SiteCopyKey.MetaTitle, locale: OwnerLocale.EnglishUs }));
    expect(portuguese.text).toContain(copy({ key: SiteCopyKey.MetaTitle, locale: OwnerLocale.PortugueseBrazil }));
    expect(portuguese.text).not.toContain(copy({ key: SiteCopyKey.MetaTitle, locale: OwnerLocale.EnglishUs }));
  });

  it('lists the llms files of every language', async () => {
    const { text } = await textOf({ path: '/llms.txt' });
    Object.values(OwnerLocale).forEach((locale) => {
      const home = localePathOf({ locale });
      const prefix = home === '/' ? '' : home;
      expect(text).toContain(`${SITE_ORIGIN}${prefix}/llms.txt`);
      expect(text).toContain(`${SITE_ORIGIN}${prefix}/llms-full.txt`);
    });
  });

  it.each(Object.values(OwnerLocale))('has a full file for %s with the home and both legal documents', async (locale) => {
    const home = localePathOf({ locale });
    const prefix = home === '/' ? '' : home;
    const { response, text } = await textOf({ path: `${prefix}/llms-full.txt` });
    expect(response.status).toBe(200);
    expect(text).toContain(`# ${copy({ key: SiteCopyKey.MetaOgTitle, locale })}`);
    Object.values(LegalDocument).forEach((document) => expect(text).toContain(`# ${legalTextOf({ document, locale }).title}`));
  });
});

describe('robots.txt', () => {
  it('allows the AI crawlers by name and lists the llms files and the sitemap', async () => {
    const { text } = await textOf({ path: '/robots.txt' });
    ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'].forEach((name) =>
      expect(text).toMatch(new RegExp(`User-agent: ${name}\\nAllow: /\\n`)),
    );
    expect(text).toContain(`${SITE_ORIGIN}/llms.txt`);
    expect(text).toContain(`${SITE_ORIGIN}/pt-br/llms-full.txt`);
    expect(text).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});
