import { COMPANY, HttpStatus, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { LegalDocument, legalPathOf } from '../../src/site/legal-links';
import { legalTextOf } from '../../src/site/legal-copy';
import { SiteCopyKey } from '../../src/site/site-copy';
import { copyHtml, escapedHtml, SITE_ORIGIN, siteFetch } from '../support/site';

const SEE_OTHER = 303;
const LEGAL_PAGES = [
  ['/terms', LegalDocument.Terms, OwnerLocale.EnglishUs, 'en'],
  ['/privacy', LegalDocument.Privacy, OwnerLocale.EnglishUs, 'en'],
  ['/pt-br/termos', LegalDocument.Terms, OwnerLocale.PortugueseBrazil, 'pt-BR'],
  ['/pt-br/privacidade', LegalDocument.Privacy, OwnerLocale.PortugueseBrazil, 'pt-BR'],
] as const;
const TWINS: Record<string, string> = {
  '/terms': '/pt-br/termos',
  '/privacy': '/pt-br/privacidade',
  '/pt-br/termos': '/terms',
  '/pt-br/privacidade': '/privacy',
};

async function htmlOf(input: { path: string }): Promise<string> {
  return (await siteFetch({ path: input.path })).text();
}

describe('the legal pages', () => {
  it.each(LEGAL_PAGES)('%s answers the %s document in its language', async (path, document, locale, language) => {
    const response = await siteFetch({ path });
    const html = await response.text();
    const text = legalTextOf({ document, locale });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(html).toContain(`<html lang="${language}"`);
    expect(html).toContain(`<h1>${escapedHtml({ text: text.title })}</h1>`);
    expect(text.sections.length).toBeGreaterThan(0);
    text.sections.forEach((section) => expect(html).toContain(`<h2>${escapedHtml({ text: section.heading })}</h2>`));
  });

  it.each(LEGAL_PAGES)('%s names the company, its CNPJ and the contact address', async (path) => {
    const html = await htmlOf({ path });
    expect(html).toContain(COMPANY.cnpj);
    expect(html).toContain(escapedHtml({ text: COMPANY.legalName }));
    expect(html).toContain(`href="mailto:${COMPANY.contactEmail}"`);
  });

  it.each(LEGAL_PAGES)('%s leaves no placeholder unfilled', async (path, document, locale) => {
    const text = legalTextOf({ document, locale });
    const strings = [
      text.title,
      text.description,
      text.summary,
      text.updated,
      ...text.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.items]),
    ];
    const unfilled = strings.filter((value) => /\{(?!contactEmail\})[a-zA-Z]+\}/.test(value));
    expect(unfilled).toEqual([]);
  });

  it.each(LEGAL_PAGES)('%s points its canonical and alternates at the twin page', async (path, _document, locale) => {
    const html = await htmlOf({ path });
    const english = locale === OwnerLocale.EnglishUs ? path : TWINS[path]!;
    const portuguese = locale === OwnerLocale.PortugueseBrazil ? path : TWINS[path]!;
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${path}"/>`);
    expect(html).toContain(`hreflang="en" href="${SITE_ORIGIN}${english}"`);
    expect(html).toContain(`hreflang="pt-BR" href="${SITE_ORIGIN}${portuguese}"`);
    expect(html).toContain(`hreflang="x-default" href="${SITE_ORIGIN}${english}"`);
    expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}${path}"/>`);
  });

  it.each(LEGAL_PAGES)('%s keeps its own address in the language and theme forms', async (path) => {
    const html = await htmlOf({ path });
    expect(html.match(new RegExp(`name="returnTo" value="${path}"`, 'g'))).toHaveLength(2);
  });

  it.each(LEGAL_PAGES)('%s loads no captcha and no demo poster, and its join link leads to the form', async (path, _document, locale) => {
    const html = await htmlOf({ path });
    expect(html).not.toContain('challenges.cloudflare.com');
    expect(html).not.toContain('rel="preload"');
    const home = locale === OwnerLocale.EnglishUs ? '/' : '/pt-br';
    expect(html).toContain(`class="button button-primary header-join" href="${home}#join"`);
    expect(html).toContain(`href="#content" class="skip-link">${copyHtml({ key: SiteCopyKey.SkipToContent, locale })}<`);
  });

  it.each(Object.keys(TWINS))('POST /locale from %s lands on the twin page', async (path) => {
    const locale = path.startsWith('/pt-br') ? OwnerLocale.EnglishUs : OwnerLocale.PortugueseBrazil;
    const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale, returnTo: path } });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(TWINS[path]);
  });

  it.each(Object.keys(TWINS))('POST /theme from %s returns to it', async (path) => {
    const response = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'light', returnTo: path } });
    expect(response.headers.get('Location')).toBe(`${path}#theme`);
  });

  it('refuses a legal path with a query as a return target', async () => {
    const response = await siteFetch({
      path: '/locale',
      method: 'POST',
      form: { locale: OwnerLocale.PortugueseBrazil, returnTo: '/terms?x=1' },
    });
    expect(response.headers.get('Location')).toBe('/pt-br');
  });
});

describe('the links to the legal pages', () => {
  it.each([
    ['/', OwnerLocale.EnglishUs],
    ['/pt-br', OwnerLocale.PortugueseBrazil],
  ])('the footer of %s links both documents in its language', async (path, locale) => {
    const html = await htmlOf({ path });
    const footer = /<footer class="site-footer">([\s\S]*?)<\/footer>/.exec(html)![1]!;
    expect(footer).toContain(
      `href="${legalPathOf({ document: LegalDocument.Terms, locale })}">${copyHtml({ key: SiteCopyKey.FooterTerms, locale })}<`,
    );
    expect(footer).toContain(
      `href="${legalPathOf({ document: LegalDocument.Privacy, locale })}">${copyHtml({ key: SiteCopyKey.FooterPrivacy, locale })}<`,
    );
  });

  it.each([
    ['/', '/privacy'],
    ['/pt-br', '/pt-br/privacidade'],
  ])('the waitlist note of %s links the privacy policy', async (path, privacyPath) => {
    const html = await htmlOf({ path });
    expect(html).toMatch(new RegExp(`<p class="privacy-note">[^<]*<a href="${privacyPath}">`));
  });

  it('the sitemap lists both documents in both languages with their alternates', async () => {
    const xml = await (await siteFetch({ path: '/sitemap.xml' })).text();
    Object.keys(TWINS).forEach((path) => expect(xml).toContain(`<loc>${SITE_ORIGIN}${path}</loc>`));
    expect(xml.match(new RegExp(`hreflang="pt-BR" href="${SITE_ORIGIN}/pt-br/termos"`, 'g'))).toHaveLength(2);
    expect(xml.match(new RegExp(`hreflang="x-default" href="${SITE_ORIGIN}/privacy"`, 'g'))).toHaveLength(2);
  });
});
