import { reset } from 'cloudflare:test';
import { OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markdownPathOf } from '../../src/site/agentic-paths';
import { legalPathOf, LegalDocument } from '../../src/site/legal-links';
import { legalTextOf } from '../../src/site/legal-copy';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { localePathOf } from '../../src/site/site-language';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';
import { applyLandingWaitlistMigration } from '../support/seed';
import { SITE_ORIGIN, siteFetch } from '../support/site';

const MARKDOWN_TYPE = 'text/markdown; charset=utf-8';
const TEXT_TYPE = 'text/plain; charset=utf-8';
const OK = 200;
const LOCALES = Object.values(OwnerLocale);
const NEW_LOCALES = LOCALES.filter((locale) => locale !== OwnerLocale.EnglishUs && locale !== OwnerLocale.PortugueseBrazil);

function llmsPrefixOf(input: { locale: OwnerLocale }): string {
  const home = localePathOf({ locale: input.locale });
  return home === '/' ? '' : home;
}

async function textOf(input: { path: string }): Promise<{ response: Response; text: string }> {
  const response = await siteFetch(input);
  return { response, text: await response.text() };
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the Markdown twins in every language', () => {
  it.each(LOCALES)('the home twin of %s answers Markdown in its language', async (locale) => {
    const { response, text } = await textOf({ path: markdownPathOf({ htmlPath: localePathOf({ locale }) }) });
    expect(response.status).toBe(OK);
    expect(response.headers.get('content-type')).toBe(MARKDOWN_TYPE);
    expect(text.startsWith(`# ${renderSiteCopy({ key: SiteCopyKey.MetaOgTitle, locale })}\n`)).toBe(true);
    expect(text).toContain(`## ${renderSiteCopy({ key: SiteCopyKey.WhyTitle, locale })}`);
  });

  it.each(NEW_LOCALES.flatMap((locale) => Object.values(LegalDocument).map((document) => [locale, document] as const)))(
    'the %s twin of the %s document answers its text',
    async (locale, document) => {
      const { response, text } = await textOf({ path: markdownPathOf({ htmlPath: legalPathOf({ document, locale }) }) });
      expect(response.status).toBe(OK);
      expect(text).toContain(legalTextOf({ document, locale }).title);
    },
  );

  it.each(NEW_LOCALES)('the HTML page of %s links its Markdown twin in the head', async (locale) => {
    const html = await (await siteFetch({ path: localePathOf({ locale }) })).text();
    expect(html).toContain(`type="text/markdown" href="${SITE_ORIGIN}${markdownPathOf({ htmlPath: localePathOf({ locale }) })}"`);
  });

  it.each(NEW_LOCALES)('answers Markdown to an agent that asks %s with an Accept header', async (locale) => {
    const response = await siteFetch({ path: localePathOf({ locale }), headers: { Accept: 'text/markdown' } });
    expect(response.headers.get('content-type')).toBe(MARKDOWN_TYPE);
  });
});

describe('the llms files in every language', () => {
  it.each(NEW_LOCALES)('%s has a summary in its language that lists its twins', async (locale) => {
    const { response, text } = await textOf({ path: `${llmsPrefixOf({ locale })}/llms.txt` });
    expect(response.status).toBe(OK);
    expect(response.headers.get('content-type')).toBe(TEXT_TYPE);
    expect(text).toContain(renderSiteCopy({ key: SiteCopyKey.MetaTitle, locale }));
    expect(text).not.toContain(renderSiteCopy({ key: SiteCopyKey.MetaTitle, locale: OwnerLocale.EnglishUs }));
    expect(text).toContain(`${SITE_ORIGIN}${markdownPathOf({ htmlPath: localePathOf({ locale }) })}`);
  });

  it.each(NEW_LOCALES)('%s has a full file with the home and both documents', async (locale) => {
    const { response, text } = await textOf({ path: `${llmsPrefixOf({ locale })}/llms-full.txt` });
    expect(response.status).toBe(OK);
    Object.values(LegalDocument).forEach((document) => expect(text).toContain(`# ${legalTextOf({ document, locale }).title}`));
  });

  it('is named in robots.txt for every language', async () => {
    const { text } = await textOf({ path: '/robots.txt' });
    LOCALES.forEach((locale) => expect(text).toContain(`${SITE_ORIGIN}${llmsPrefixOf({ locale })}/llms-full.txt`));
  });
});

describe('the JSON answers in every language', () => {
  it.each(NEW_LOCALES)('answers the plans in %s, in dollars', async (locale) => {
    const tag = LOCALE_PROFILES[locale].languageTag;
    const response = await siteFetch({ path: `/api/pricing?language=${tag}` });
    const body = (await response.json()) as { language: string; currency: string };
    expect(response.status).toBe(OK);
    expect(body.language).toBe(tag);
    expect(body.currency).toBe('USD');
  });

  it('lists every language in the well-known documents', async () => {
    const card = await (await siteFetch({ path: '/.well-known/agent-card.json' })).text();
    const security = await (await siteFetch({ path: '/.well-known/security.txt' })).text();
    LOCALES.forEach((locale) => expect(security).toContain(LOCALE_PROFILES[locale].languageTag.split('-')[0]));
    expect(card.length).toBeGreaterThan(0);
  });
});
