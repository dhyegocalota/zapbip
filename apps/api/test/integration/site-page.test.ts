import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { DEFAULT_LOCALE, OwnerLocale, TURNSTILE_ACTION_WAITLIST_JOIN } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { leadingAgentNames } from '../../src/site/site-agents';
import { SiteCopyKey } from '../../src/site/site-copy';
import { SITE_CONTENT_SECURITY_POLICY } from '../../src/site/site-policy';
import { copyHtml, escapedHtml, REFERRAL_CODE, SITE_ORIGIN, SITE_TURNSTILE_SITE_KEY, siteEnvironment, siteFetch } from '../support/site';

const ENGLISH_HEADERS = { 'Accept-Language': 'en-US,en;q=0.9' };
const PORTUGUESE_HEADERS = { 'Accept-Language': 'pt-BR,pt;q=0.9' };
const LOCALE_COOKIE = '__Host-zb_site_locale';
const THEME_COOKIE = '__Host-zb_site_theme';
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)[^>]*>/;
const INLINE_STYLE_PATTERN = /<style|\sstyle="/;
const SEE_OTHER = 303;

async function pageOf(input: { path?: string; headers?: Record<string, string> }): Promise<string> {
  const { path = '/', headers } = input;
  const response = await siteFetch({ path, headers });
  expect(response.status).toBe(200);
  return response.text();
}

describe('GET /', () => {
  it('renders the first fold in en_US', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    const copy = (key: SiteCopyKey): string => copyHtml({ key, locale: OwnerLocale.EnglishUs });
    expect(html).toContain('<html lang="en"');
    expect(html).toContain(copy(SiteCopyKey.HeroTitleLead));
    expect(html).toContain(copy(SiteCopyKey.HeroTitleAccent));
    expect(html).toContain(
      copyHtml({
        key: SiteCopyKey.HeroLead,
        locale: OwnerLocale.EnglishUs,
        values: { agents: leadingAgentNames() },
      }),
    );
    expect(html).toContain(copy(SiteCopyKey.JoinSubmit));
    expect(html).toContain('id="join-email"');
  });

  it('renders the first fold in pt_BR', async () => {
    const html = await pageOf({ headers: PORTUGUESE_HEADERS });
    const copy = (key: SiteCopyKey): string => copyHtml({ key, locale: OwnerLocale.PortugueseBrazil });
    expect(html).toContain('<html lang="pt-BR"');
    expect(html).toContain(copy(SiteCopyKey.HeroTitleLead));
    expect(html).toContain(copy(SiteCopyKey.JoinSubmit));
  });

  it('uses the default locale with no cookie and no Accept-Language', async () => {
    const html = await pageOf({});
    expect(DEFAULT_LOCALE).toBe(OwnerLocale.PortugueseBrazil);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.HeroTitleLead, locale: DEFAULT_LOCALE }));
  });

  it('the locale cookie wins over Accept-Language', async () => {
    const html = await pageOf({ headers: { ...PORTUGUESE_HEADERS, Cookie: `${LOCALE_COOKIE}=${OwnerLocale.EnglishUs}` } });
    expect(html).toContain('<html lang="en"');
  });

  it('the lang query wins over the cookie', async () => {
    const html = await pageOf({ path: '/?lang=pt-BR', headers: { Cookie: `${LOCALE_COOKIE}=${OwnerLocale.EnglishUs}` } });
    expect(html).toContain('<html lang="pt-BR"');
  });

  it('carries a well-formed referral code into the form and shows the invited eyebrow', async () => {
    const html = await pageOf({ path: `/?ref=${REFERRAL_CODE}`, headers: ENGLISH_HEADERS });
    expect(html).toContain(`name="referralCode" value="${REFERRAL_CODE}"`);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.HeroInvited, locale: OwnerLocale.EnglishUs }));
  });

  it('drops a malformed referral code and shows the plain eyebrow', async () => {
    const html = await pageOf({ path: '/?ref=../../x', headers: ENGLISH_HEADERS });
    expect(html).not.toContain('name="referralCode"');
    expect(html).toContain(copyHtml({ key: SiteCopyKey.HeroEyebrow, locale: OwnerLocale.EnglishUs }));
  });

  it('renders the Turnstile widget with the site key and the join action', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain(`data-sitekey="${SITE_TURNSTILE_SITE_KEY}"`);
    expect(html).toContain(`data-action="${TURNSTILE_ACTION_WAITLIST_JOIN}"`);
    expect(html).toContain('src="https://challenges.cloudflare.com/turnstile/v0/api.js"');
  });

  it.each([undefined, '', '   '])('replaces the form with the paused notice when the secret is %j', async (secret) => {
    const response = await siteFetch({
      path: '/',
      headers: ENGLISH_HEADERS,
      env: siteEnvironment({ overrides: { TURNSTILE_SECRET_KEY: secret } }),
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.JoinPausedTitle, locale: OwnerLocale.EnglishUs }));
    expect(html).not.toContain('id="join-email"');
    expect(html).not.toContain('cf-turnstile');
    expect(html).not.toContain('challenges.cloudflare.com');
  });

  it('shows the demo as a poster first with a lazy muted loop', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain('class="demo-poster"');
    expect(html).toContain('fetchpriority="high"');
    expect(html).toMatch(/<video[^>]*\bmuted\b[^>]*\bloop\b[^>]*\bplaysinline\b[^>]*preload="none"/);
    expect(html).toContain('/site/demo-en_US-960.mp4');
    expect(html).toContain('/site/demo-en_US-960.webm');
    expect(html).toContain('/site/demo-en_US-poster-960.webp');
    expect(html).not.toContain('pt_BR-960');
  });

  it('has the sections of the design in order', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    const order = ['id="join"', 'id="how"', 'id="capabilities"', 'id="clients"', 'id="privacy"', 'id="faq"', 'class="final'];
    const positions = order.map((marker) => html.indexOf(marker));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((first, second) => first - second)).toEqual(positions);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it('puts the canonical, social and alternate links in the head', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/"`);
    expect(html).toContain(`<meta property="og:image" content="${SITE_ORIGIN}/site/og-en_US.png"`);
    expect(html).toContain(`<meta name="twitter:image" content="${SITE_ORIGIN}/site/og-en_US.png"`);
    expect(html).toContain('<meta property="og:image:width" content="1200"');
    expect(html).toContain('<meta property="og:image:height" content="630"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('hreflang="pt-BR"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain(`<title>${copyHtml({ key: SiteCopyKey.MetaTitle, locale: OwnerLocale.EnglishUs })} · zapbip</title>`);
    expect(html).toContain('rel="icon"');
  });

  it('puts the contact link only in the two places whose copy asks for it', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html.match(/mailto:/g)).toHaveLength(2);
  });

  it('keeps the page inside its policy: no inline script, no inline style', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).not.toMatch(INLINE_SCRIPT_PATTERN);
    expect(html).not.toMatch(INLINE_STYLE_PATTERN);
  });

  it('sends the site policy and no-store-free caching headers', async () => {
    const response = await siteFetch({ path: '/' });
    expect(response.headers.get('Content-Security-Policy')).toBe(SITE_CONTENT_SECURITY_POLICY);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Vary')).toContain('Accept-Language');
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('applies the theme cookie to the document', async () => {
    const html = await pageOf({ headers: { Cookie: `${THEME_COOKIE}=dark` } });
    expect(html).toContain('data-theme="dark"');
  });
});

describe('the Portuguese page', () => {
  it('chooses the Portuguese demo, poster, social image and widget language', async () => {
    const html = await pageOf({ headers: PORTUGUESE_HEADERS });
    expect(html).toContain('/site/demo-pt_BR-960.mp4');
    expect(html).toContain('/site/demo-pt_BR-960.webm');
    expect(html).toContain('/site/demo-pt_BR-poster-960.webp');
    expect(html).toContain('/site/demo-pt_BR-poster-540.webp');
    expect(html).toContain(`<meta property="og:image" content="${SITE_ORIGIN}/site/og-pt_BR.png"`);
    expect(html).toContain(`<meta name="twitter:image" content="${SITE_ORIGIN}/site/og-pt_BR.png"`);
    expect(html).toContain('data-language="pt-br"');
    expect(html).not.toContain('en_US-960');
  });

  it('writes the title, description, alt text and privacy note in Portuguese', async () => {
    const html = await pageOf({ headers: PORTUGUESE_HEADERS });
    const copy = (key: SiteCopyKey): string => copyHtml({ key, locale: OwnerLocale.PortugueseBrazil });
    expect(html).toContain(`<title>${copy(SiteCopyKey.MetaTitle)} · zapbip</title>`);
    expect(html).toContain(copy(SiteCopyKey.MetaOgImageAlt));
    expect(html).toContain(copy(SiteCopyKey.PrivacyNoteShort));
  });

  it('shows every error state in Portuguese', async () => {
    const response = await siteFetch({ path: '/nope', headers: PORTUGUESE_HEADERS });
    expect(await response.text()).toContain(copyHtml({ key: SiteCopyKey.NotFoundTitle, locale: OwnerLocale.PortugueseBrazil }));
  });
});

describe('the works-with section', () => {
  const names = Object.values(AGENT_INSTALLS).map((install) => install.productName);

  it.each([
    ['en_US', ENGLISH_HEADERS],
    ['pt_BR', PORTUGUESE_HEADERS],
  ])('shows one tile per installable agent, in registry order, named by the registry in %s', async (_locale, headers) => {
    const html = await pageOf({ headers });
    const section = html.slice(html.indexOf('id="clients"'), html.indexOf('id="privacy"'));
    const tiles = [...section.matchAll(/<div class="card client[^"]*"><strong>([^<]+)<\/strong>/g)].map((match) => match[1]);
    expect(tiles.slice(0, names.length)).toEqual(names.map((name) => escapedHtml({ text: name })));
  });

  it('ends with the tile for any MCP app', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    const section = html.slice(html.indexOf('id="clients"'), html.indexOf('id="privacy"'));
    expect(section).toContain(copyHtml({ key: SiteCopyKey.ClientsAnyMcpName, locale: OwnerLocale.EnglishUs }));
  });

  it('names the first two agents of the registry in the subhead', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain(`${names[0]}, ${names[1]} and any MCP agent`);
  });
});

describe('site assets', () => {
  it('serves the stylesheet linked from the page, cacheable for a year', async () => {
    const html = await pageOf({});
    const href = /<link rel="stylesheet" href="([^"]+)"/.exec(html)![1]!;
    const response = await siteFetch({ path: href });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/css');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
  });

  it('serves the script linked from the page', async () => {
    const html = await pageOf({});
    const src = /<script src="([^"]+site\.js[^"]*)"/.exec(html)![1]!;
    const response = await siteFetch({ path: src });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/javascript');
  });
});

describe('preferences and redirects', () => {
  it('POST /locale sets the cookie and returns to the page keeping the referral code', async () => {
    const response = await siteFetch({
      path: '/locale',
      method: 'POST',
      form: { locale: OwnerLocale.EnglishUs, returnTo: `/?ref=${REFERRAL_CODE}` },
    });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/?ref=${REFERRAL_CODE}`);
    expect(response.headers.get('Set-Cookie')).toContain(`${LOCALE_COOKIE}=${OwnerLocale.EnglishUs}`);
  });

  it.each(['//evil.example', 'https://evil.example/', '/numbers', '/?ref=../../x'])(
    'POST /locale refuses the return target %s',
    async (returnTo) => {
      const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale: OwnerLocale.EnglishUs, returnTo } });
      expect(response.headers.get('Location')).toBe('/');
    },
  );

  it('POST /locale ignores an unknown locale', async () => {
    const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale: 'xx_XX', returnTo: '/' } });
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('POST /theme sets the cookie only for a known theme', async () => {
    const known = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'dark', returnTo: '/' } });
    expect(known.headers.get('Set-Cookie')).toContain(`${THEME_COOKIE}=dark`);
    const unknown = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'neon', returnTo: '/' } });
    expect(unknown.headers.get('Set-Cookie')).toBeNull();
  });

  it('GET /join answers 303 to the page, keeping a well-formed ref', async () => {
    const response = await siteFetch({ path: `/join?ref=${REFERRAL_CODE}` });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/?ref=${REFERRAL_CODE}`);
  });

  it('answers a not-found page with noindex for an unknown path', async () => {
    const response = await siteFetch({ path: '/nope', headers: ENGLISH_HEADERS });
    const html = await response.text();
    expect(response.status).toBe(404);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.NotFoundTitle, locale: OwnerLocale.EnglishUs }));
    expect(html).toContain('<meta name="robots" content="noindex"');
  });
});
