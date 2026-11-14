import { COMPANY, HttpStatus, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { LegalDocument, legalPathOf } from '../../src/site/legal-links';
import { localePathOf } from '../../src/site/site-language';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';
import { legalTextOf } from '../../src/site/legal-copy';
import { SiteCopyKey } from '../../src/site/site-copy';
import { ShellCopyKey } from '../../src/web-shell/shell-copy';
import { copyHtml, escapedHtml, shellCopyHtml, SITE_ORIGIN, siteFetch } from '../support/site';

const SEE_OTHER = 303;
const LOCALES = Object.values(OwnerLocale);
const LEGAL_PAGES = Object.values(LegalDocument).flatMap((document) =>
  LOCALES.map((locale) => [legalPathOf({ document, locale }), document, locale, LOCALE_PROFILES[locale].languageTag] as const),
);
const LEGAL_PATHS = LEGAL_PAGES.map(([path]) => path);
const PORTUGUESE_PATHS = ['/pt-br/termos', '/pt-br/privacidade'];

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

  it.each(LEGAL_PAGES)('%s points its canonical and the alternates of every language at its twins', async (path, document) => {
    const html = await htmlOf({ path });
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${path}"/>`);
    LOCALES.forEach((twinLocale) =>
      expect(html).toContain(
        `hreflang="${LOCALE_PROFILES[twinLocale].languageTag}" href="${SITE_ORIGIN}${legalPathOf({ document, locale: twinLocale })}"`,
      ),
    );
    expect(html).toContain(`hreflang="x-default" href="${SITE_ORIGIN}${legalPathOf({ document, locale: OwnerLocale.EnglishUs })}"`);
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
    const home = localePathOf({ locale });
    expect(html).toContain(`class="button button-primary header-join" href="${home}#join"`);
    expect(html).toContain(`href="#content" class="skip-link">${copyHtml({ key: SiteCopyKey.SkipToContent, locale })}<`);
  });

  it.each(LEGAL_PAGES)('POST /locale from %s lands on the twin page of every other language', async (path, document) => {
    const landings = await Promise.all(
      LOCALES.map(async (locale) => {
        const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale, returnTo: path } });
        return [response.status, response.headers.get('Location')];
      }),
    );
    expect(landings).toEqual(LOCALES.map((locale) => [SEE_OTHER, legalPathOf({ document, locale })]));
  });

  it.each(LEGAL_PATHS)('POST /theme from %s returns to it', async (path) => {
    const response = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'light', returnTo: path } });
    expect(response.headers.get('Location')).toBe(`${path}#theme`);
  });

  it.each([OwnerLocale.PortugueseBrazil, OwnerLocale.Japanese])(
    'refuses a legal path with a query as a return target for %s',
    async (locale) => {
      const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale, returnTo: '/terms?x=1' } });
      expect(response.headers.get('Location')).toBe(localePathOf({ locale }));
    },
  );
});

describe('the links to the legal pages', () => {
  it.each(LOCALES)('the footer of the %s home links both documents in its language', async (locale) => {
    const html = await htmlOf({ path: localePathOf({ locale }) });
    const footer = /<footer class="site-footer">([\s\S]*?)<\/footer>/.exec(html)![1]!;
    expect(footer).toContain(
      `href="${legalPathOf({ document: LegalDocument.Terms, locale })}">${shellCopyHtml({ key: ShellCopyKey.FooterTerms, locale })}<`,
    );
    expect(footer).toContain(
      `href="${legalPathOf({ document: LegalDocument.Privacy, locale })}">${shellCopyHtml({ key: ShellCopyKey.FooterPrivacy, locale })}<`,
    );
  });

  it.each(LOCALES)('the waitlist note of the %s home links the privacy policy', async (locale) => {
    const html = await htmlOf({ path: localePathOf({ locale }) });
    const privacyPath = legalPathOf({ document: LegalDocument.Privacy, locale });
    expect(html).toMatch(new RegExp(`<p class="privacy-note">[^<]*<a href="${privacyPath}">`));
  });

  it('keeps the Portuguese slugs and gives every other language the English slugs under its prefix', () => {
    expect(PORTUGUESE_PATHS).toEqual(
      Object.values(LegalDocument).map((document) => legalPathOf({ document, locale: OwnerLocale.PortugueseBrazil })),
    );
    expect(legalPathOf({ document: LegalDocument.Terms, locale: OwnerLocale.Japanese })).toBe('/ja/terms');
    expect(legalPathOf({ document: LegalDocument.Privacy, locale: OwnerLocale.ChineseSimplified })).toBe('/zh/privacy');
  });

  it('the sitemap lists every document in every language with its alternates', async () => {
    const xml = await (await siteFetch({ path: '/sitemap.xml' })).text();
    LEGAL_PAGES.forEach(([path]) => expect(xml).toContain(`<loc>${SITE_ORIGIN}${path}</loc>`));
    expect(xml.match(new RegExp(`hreflang="pt-BR" href="${SITE_ORIGIN}/pt-br/termos"`, 'g'))).toHaveLength(LOCALES.length);
    expect(xml.match(new RegExp(`hreflang="x-default" href="${SITE_ORIGIN}/privacy"`, 'g'))).toHaveLength(LOCALES.length);
  });
});
