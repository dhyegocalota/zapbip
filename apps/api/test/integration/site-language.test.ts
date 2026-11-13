import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { REFERRAL_CODE, SITE_ORIGIN, siteFetch } from '../support/site';

const MOVED_PERMANENTLY = 301;
const FOUND = 302;
const SEE_OTHER = 303;
const OK = 200;
const LOCALE_COOKIE = '__Host-zb_site_locale';
const THEME_COOKIE = '__Host-zb_site_theme';
const PORTUGUESE_ACCEPT = { 'Accept-Language': 'pt-BR,pt;q=0.9' };
const ENGLISH_ACCEPT = { 'Accept-Language': 'en-US,en;q=0.9' };

describe('the language paths', () => {
  it('serves English at the root with no hint from the visitor', async () => {
    const response = await siteFetch({ path: '/' });
    expect(response.status).toBe(OK);
    expect(await response.text()).toContain('<html lang="en"');
  });

  it('serves Portuguese at /pt-br whatever the cookie or the header says', async () => {
    const response = await siteFetch({
      path: '/pt-br',
      headers: { ...ENGLISH_ACCEPT, Cookie: `${LOCALE_COOKIE}=${OwnerLocale.EnglishUs}` },
    });
    expect(response.status).toBe(OK);
    expect(await response.text()).toContain('<html lang="pt-BR"');
  });

  it('sends a Portuguese browser with no cookie from the root to /pt-br, varying on the header', async () => {
    const response = await siteFetch({ path: '/', headers: PORTUGUESE_ACCEPT });
    expect(response.status).toBe(FOUND);
    expect(response.headers.get('Location')).toBe('/pt-br');
    expect(response.headers.get('Vary')).toContain('Accept-Language');
  });

  it('keeps the query when it sends a Portuguese browser on', async () => {
    const response = await siteFetch({ path: `/?ref=${REFERRAL_CODE}&agent=codex`, headers: PORTUGUESE_ACCEPT });
    expect(response.headers.get('Location')).toBe(`/pt-br?agent=codex&ref=${REFERRAL_CODE}`);
  });

  it('sends a visitor whose cookie says Portuguese to /pt-br', async () => {
    const response = await siteFetch({ path: '/', headers: { Cookie: `${LOCALE_COOKIE}=${OwnerLocale.PortugueseBrazil}` } });
    expect(response.status).toBe(FOUND);
    expect(response.headers.get('Location')).toBe('/pt-br');
  });

  it('keeps an English cookie at the root even for a Portuguese browser', async () => {
    const response = await siteFetch({ path: '/', headers: { ...PORTUGUESE_ACCEPT, Cookie: `${LOCALE_COOKIE}=${OwnerLocale.EnglishUs}` } });
    expect(response.status).toBe(OK);
  });

  it('gives a crawler with no language header the English page', async () => {
    const response = await siteFetch({ path: '/', headers: { 'User-Agent': 'Googlebot' } });
    expect(response.status).toBe(OK);
  });

  it.each([
    ['/pt-br/', '/pt-br'],
    [`/pt-br/?ref=${REFERRAL_CODE}`, `/pt-br?ref=${REFERRAL_CODE}`],
  ])('answers %s with a 301 to %s', async (path, target) => {
    const response = await siteFetch({ path });
    expect(response.status).toBe(MOVED_PERMANENTLY);
    expect(response.headers.get('Location')).toBe(target);
  });

  it.each([
    ['/?lang=pt_BR', '/pt-br'],
    ['/?lang=pt-BR', '/pt-br'],
    ['/?lang=en_US', '/'],
    ['/?lang=en', '/'],
    ['/pt-br?lang=en', '/'],
    [`/?lang=pt_BR&ref=${REFERRAL_CODE}&agent=codex`, `/pt-br?agent=codex&ref=${REFERRAL_CODE}`],
  ])('answers the legacy %s with a 301 to %s', async (path, target) => {
    const response = await siteFetch({ path, headers: PORTUGUESE_ACCEPT });
    expect(response.status).toBe(MOVED_PERMANENTLY);
    expect(response.headers.get('Location')).toBe(target);
  });

  it('ignores a language value it does not know', async () => {
    const response = await siteFetch({ path: '/?lang=xx' });
    expect(response.status).toBe(OK);
  });
});

describe('the head of each page', () => {
  it.each([
    ['/', '/'],
    ['/pt-br', '/pt-br'],
  ])('points the canonical, the alternates and og:url of %s at the paths', async (path, canonicalPath) => {
    const html = await (await siteFetch({ path })).text();
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${canonicalPath}"`);
    expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}${canonicalPath}"`);
    expect(html).toContain(`hreflang="en" href="${SITE_ORIGIN}/"`);
    expect(html).toContain(`hreflang="pt-BR" href="${SITE_ORIGIN}/pt-br"`);
    expect(html).toContain(`hreflang="x-default" href="${SITE_ORIGIN}/"`);
    expect(html).not.toContain('?lang=');
  });
});

describe('the links of a page', () => {
  it('keep the path, the agent and the referral code in the tabs, the call to action and the preference forms', async () => {
    const html = await (await siteFetch({ path: `/pt-br?agent=codex&ref=${REFERRAL_CODE}` })).text();
    expect(html).toContain(`href="/pt-br?agent=codex&amp;ref=${REFERRAL_CODE}#start"`);
    expect(html).toContain(`href="/pt-br?agent=codex&amp;ref=${REFERRAL_CODE}#join"`);
    expect(html).toContain(`name="returnTo" value="/pt-br?agent=codex&amp;ref=${REFERRAL_CODE}"`);
    expect(html).not.toContain('lang=pt');
  });

  it('keep the agent when the page is in English', async () => {
    const html = await (await siteFetch({ path: '/?agent=any' })).text();
    expect(html).toContain('name="returnTo" value="/?agent=any"');
  });
});

describe('the preference forms', () => {
  it('POST /locale sets the cookie and goes to the path of the chosen language, keeping the agent and the code', async () => {
    const response = await siteFetch({
      path: '/locale',
      method: 'POST',
      form: { locale: OwnerLocale.PortugueseBrazil, returnTo: `/?agent=codex&ref=${REFERRAL_CODE}` },
    });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/pt-br?agent=codex&ref=${REFERRAL_CODE}`);
    expect(response.headers.get('Set-Cookie')).toContain(`${LOCALE_COOKIE}=${OwnerLocale.PortugueseBrazil}`);
  });

  it.each([
    ['//evil.example', '/pt-br'],
    ['https://evil.example/', '/pt-br'],
    ['/numbers', '/pt-br'],
    ['/?agent=../x', '/pt-br'],
    ['/?x=1', '/pt-br'],
  ])('POST /locale refuses the return target %s', async (returnTo, target) => {
    const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale: OwnerLocale.PortugueseBrazil, returnTo } });
    expect(response.headers.get('Location')).toBe(target);
  });

  it.each(['/pt-br', '/', '/pt-br?agent=codex', `/?ref=${REFERRAL_CODE}`, '/?agent=any'])('POST /theme returns to %s', async (returnTo) => {
    const response = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'light', returnTo } });
    expect(response.headers.get('Location')).toBe(`${returnTo}#theme`);
    expect(response.headers.get('Set-Cookie')).toContain(`${THEME_COOKIE}=light`);
  });

  it.each([['/pt-br?x=1'], ['//evil.example'], ['/?lang=pt-BR'], ['/pt-br/']])('POST /theme refuses %s and goes home', async (returnTo) => {
    const response = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'light', returnTo } });
    expect(response.headers.get('Location')).toBe('/#theme');
  });
});

describe('the sitemap', () => {
  it('lists each language page with every alternate', async () => {
    const xml = await (await siteFetch({ path: '/sitemap.xml' })).text();
    expect(xml.match(/<loc>/g)).toHaveLength(2);
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/pt-br</loc>`);
    expect(xml.match(new RegExp(`hreflang="pt-BR" href="${SITE_ORIGIN}/pt-br"`, 'g'))).toHaveLength(2);
    expect(xml.match(new RegExp(`hreflang="x-default" href="${SITE_ORIGIN}/"`, 'g'))).toHaveLength(2);
  });
});
