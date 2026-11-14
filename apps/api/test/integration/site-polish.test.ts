import { reset } from 'cloudflare:test';
import { COMPANY, WebLocale, PRODUCTION_PUBLIC_ORIGIN } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONNECTION_SECRET_PATTERN } from '../../src/contract/constants';
import { SITE_COPY, SiteCopyKey } from '../../src/site/site-copy';
import { SITE_STYLESHEET } from '../../src/site/site-stylesheet';
import { ShellCopyKey } from '../../src/web-shell/shell-copy';
import { applyLandingWaitlistMigration } from '../support/seed';
import { copyHtml, joinForm, shellCopyHtml, siteFetch } from '../support/site';

const ENGLISH_PATHS = ['/', '/terms'] as const;
const LOGIC_BIT_ORIGIN = 'https://logicbit.com.br';
const LOCALIZED_PAGES = [
  ['/', WebLocale.EnglishUs, '/'],
  ['/pt-br', WebLocale.PortugueseBrazil, '/pt-br'],
  ['/terms', WebLocale.EnglishUs, '/'],
  ['/pt-br/termos', WebLocale.PortugueseBrazil, '/pt-br'],
] as const;
const FOOTER_PATTERN = /<footer class="site-footer">([\s\S]*?)<\/footer>/;
const HEADER_PATTERN = /<header class="site-header">([\s\S]*?)<\/header>/;
const REFERRAL_UI_MARKERS = ['id="invite-link"', 'copy-link', 'invite-meter', 'invite-count', 'https://wa.me/'];
const EXAMPLE_LINK_PATTERN = new RegExp(`${PRODUCTION_PUBLIC_ORIGIN}/c/(zb_conn_[A-Za-z0-9_-]{43})/mcp`);
const MARIA = 'maria@example.com';

async function htmlOf(input: { path: string }): Promise<string> {
  return (await siteFetch({ path: input.path })).text();
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the language menu in the footer', () => {
  it.each(LOCALIZED_PAGES)('lives in the footer and not in the header of %s', async (path) => {
    const html = await htmlOf({ path });
    expect(HEADER_PATTERN.exec(html)![1]).not.toContain('lang-menu');
    expect(FOOTER_PATTERN.exec(html)![1]).toContain('<details class="lang-menu">');
    expect(html.match(/class="lang-menu"/g)).toHaveLength(1);
  });

  it('keeps the POST /locale form with the return path of the legal twin', async () => {
    const footer = FOOTER_PATTERN.exec(await htmlOf({ path: '/pt-br/termos' }))![1]!;
    expect(footer).toContain('action="/locale"');
    expect(footer).toContain('name="returnTo" value="/pt-br/termos"');
  });

  it('opens upward', () => {
    expect(SITE_STYLESHEET).toMatch(
      /\.site-footer \.lang-list,\n\.shell-footer \.lang-list \{[^}]*bottom: calc\(100% \+ var\(--space-2\)\);/,
    );
  });
});

describe('the footer', () => {
  it.each(LOCALIZED_PAGES)('groups product, legal and company links on %s', async (path, locale, home) => {
    const footer = FOOTER_PATTERN.exec(await htmlOf({ path }))![1]!;
    [SiteCopyKey.FooterProduct, SiteCopyKey.FooterLegalLabel, SiteCopyKey.FooterCompany].forEach((key) =>
      expect(footer).toContain(copyHtml({ key, locale })),
    );
    expect(footer).toContain(`href="${home}#pricing"`);
    expect(footer).toContain(`href="${home}#start"`);
    expect(footer).toContain('href="https://docs.zapbip.com');
    expect(footer).toContain(`href="mailto:${COMPANY.contactEmail}"`);
    expect(footer).toContain(`href="${LOGIC_BIT_ORIGIN}" rel="noopener"`);
    expect(footer).toContain(shellCopyHtml({ key: ShellCopyKey.FooterMadeBy, locale }));
  });

  it.each(ENGLISH_PATHS)('draws a huge decorative wordmark from text on %s', async (path) => {
    const footer = FOOTER_PATTERN.exec(await htmlOf({ path }))![1]!;
    expect(footer).toMatch(/<div class="footer-wordmark" aria-hidden="true">zapbip<\/div>/);
    expect(footer).not.toMatch(/<img/);
  });

  it('keeps the theme icons in the footer', async () => {
    const footer = FOOTER_PATTERN.exec(await htmlOf({ path: '/' }))![1]!;
    expect(footer).toContain('name="theme"');
  });

  it('fits the wordmark to the container width in both themes with no style attribute', async () => {
    expect(SITE_STYLESHEET).toMatch(/\.footer-wordmark \{[^}]*font-size: [^;]*vw/);
    expect(SITE_STYLESHEET).toMatch(/\.footer-wordmark \{[^}]*background-clip: text/);
    expect(await htmlOf({ path: '/' })).not.toMatch(/ style="/);
  });
});

describe('the access call to action', () => {
  it.each([
    [WebLocale.EnglishUs, '/', 'Request access', 'Get started free'],
    [WebLocale.PortugueseBrazil, '/pt-br', 'Pedir acesso', 'Comece grátis'],
  ])('says %s on the header, the form, the pricing cards and the final call', async (locale, path, label, retired) => {
    const html = await htmlOf({ path });
    expect(HEADER_PATTERN.exec(html)![1]).toContain(`>${label}</a>`);
    expect(html).toMatch(new RegExp(`<span data-label[^>]*>${label}</span>`));
    const pricing = html.slice(html.indexOf('id="pricing"'), html.indexOf('id="privacy"'));
    expect(pricing.match(new RegExp(`>${label}</a>`, 'g'))).toHaveLength(2);
    const finalCall = html.slice(html.indexOf('id="final-title"'), html.indexOf('<footer'));
    expect(finalCall).toContain(`>${label}</a>`);
    expect(html).not.toContain(retired);
  });

  it('keeps the final call to one line and one button', async () => {
    const html = await htmlOf({ path: '/' });
    const finalCall = html.slice(html.indexOf('id="final-title"'), html.indexOf('<footer'));
    expect(finalCall.match(/<a /g)).toHaveLength(1);
    expect(finalCall).not.toContain('hero-card');
  });
});

describe('the quick start example link', () => {
  it.each([
    ['/', WebLocale.EnglishUs],
    ['/pt-br', WebLocale.PortugueseBrazil],
  ])('shows a connection link in the real format with a caption on %s', async (path, locale) => {
    const html = await htmlOf({ path });
    const secret = EXAMPLE_LINK_PATTERN.exec(html)![1]!;
    expect(CONNECTION_SECRET_PATTERN.test(secret)).toBe(true);
    expect(html).not.toMatch(/&lt;(your|seu)-link&gt;/);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.StartExampleCaption, locale }));
    expect(html).toContain(`data-code="`);
  });

  it('copies the example exactly as shown', async () => {
    const html = await htmlOf({ path: '/' });
    const dataCodes = [...html.matchAll(/data-code="([^"]*)"/g)].map((match) => match[1]!);
    expect(dataCodes.length).toBeGreaterThan(0);
    dataCodes.forEach((code) => expect(code).toMatch(EXAMPLE_LINK_PATTERN));
  });
});

describe('the thank-you panel while access is closed', () => {
  it.each([
    [WebLocale.EnglishUs, '/'],
    [WebLocale.PortugueseBrazil, '/pt-br'],
  ])('confirms the early access list in %s with no referral surface', async (locale) => {
    const response = await siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: MARIA, locale }) });
    const html = await response.text();
    expect(html).toContain(copyHtml({ key: SiteCopyKey.ThanksTitle, locale }));
    expect(html).toContain(copyHtml({ key: SiteCopyKey.ThanksBody, locale }));
    REFERRAL_UI_MARKERS.forEach((marker) => expect(html).not.toContain(marker));
    expect(html).not.toContain(copyHtml({ key: SiteCopyKey.FaqReferralQuestion, locale }));
    expect(html).not.toContain(MARIA);
  });

  it('shows no invite button in the final call after joining', async () => {
    const response = await siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: MARIA }) });
    expect(await response.text()).not.toContain(copyHtml({ key: SiteCopyKey.FinalButtonInvite, locale: WebLocale.EnglishUs }));
  });
});

describe('the Brazilian Portuguese copy', () => {
  it('has no literal "você toca" or "seu toque"', async () => {
    const texts = Object.values(SITE_COPY[WebLocale.PortugueseBrazil]);
    expect(texts.filter((text) => /você toca|seu toque|\bsua vez de tocar/i.test(text))).toEqual([]);
    const html = await htmlOf({ path: '/pt-br' });
    expect(html).not.toMatch(/Você toca|seu toque/i);
  });

  it('asks and answers with a tap in natural words', () => {
    const copy = SITE_COPY[WebLocale.PortugueseBrazil];
    expect(copy[SiteCopyKey.WhyAskTitle]).toBe('O agente pergunta. Você responde com um toque.');
    expect(copy[SiteCopyKey.DemoStepTap]).toBe('Você responde');
    expect(copy[SiteCopyKey.HeroLead]).toContain('esperam sua resposta');
  });
});

describe('the contact address', () => {
  it('is the company contact on the legal footer and the home page', async () => {
    expect(await htmlOf({ path: '/terms' })).toContain(`href="mailto:${COMPANY.contactEmail}"`);
    expect(await htmlOf({ path: '/pt-br' })).toContain(`href="mailto:${COMPANY.contactEmail}"`);
  });
});
