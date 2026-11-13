import { WebLocale } from '@zapbip/types';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { localePathOf } from '../../src/site/site-language';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';
import { describe, expect, it } from 'vitest';
import { escapedHtml, REFERRAL_CODE, SITE_ORIGIN, siteFetch } from '../support/site';
import { AGENT_INSTALLS } from '@zapbip/agents/install';

const PICKED_AGENT = Object.keys(AGENT_INSTALLS)[0]!;

const MOVED_PERMANENTLY = 301;
const FOUND = 302;
const SEE_OTHER = 303;
const OK = 200;
const LOCALE_COOKIE = '__Host-zb_site_locale';
const THEME_COOKIE = '__Host-zb_site_theme';
const LOCALES = Object.values(WebLocale);
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
      headers: { ...ENGLISH_ACCEPT, Cookie: `${LOCALE_COOKIE}=${WebLocale.EnglishUs}` },
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
    const response = await siteFetch({ path: `/?ref=${REFERRAL_CODE}&agent=${PICKED_AGENT}`, headers: PORTUGUESE_ACCEPT });
    expect(response.headers.get('Location')).toBe(`/pt-br?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}`);
  });

  it('sends a visitor whose cookie says Portuguese to /pt-br', async () => {
    const response = await siteFetch({ path: '/', headers: { Cookie: `${LOCALE_COOKIE}=${WebLocale.PortugueseBrazil}` } });
    expect(response.status).toBe(FOUND);
    expect(response.headers.get('Location')).toBe('/pt-br');
  });

  it('keeps an English cookie at the root even for a Portuguese browser', async () => {
    const response = await siteFetch({ path: '/', headers: { ...PORTUGUESE_ACCEPT, Cookie: `${LOCALE_COOKIE}=${WebLocale.EnglishUs}` } });
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
    [`/?lang=pt_BR&ref=${REFERRAL_CODE}&agent=${PICKED_AGENT}`, `/pt-br?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}`],
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
    const html = await (await siteFetch({ path: `/pt-br?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}` })).text();
    expect(html).toContain(`href="/pt-br?agent=${PICKED_AGENT}&amp;ref=${REFERRAL_CODE}#start"`);
    expect(html).toContain(`href="/pt-br?agent=${PICKED_AGENT}&amp;ref=${REFERRAL_CODE}#join"`);
    expect(html).toContain(`name="returnTo" value="/pt-br?agent=${PICKED_AGENT}&amp;ref=${REFERRAL_CODE}"`);
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
      form: { locale: WebLocale.PortugueseBrazil, returnTo: `/?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}` },
    });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/pt-br?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}`);
    expect(response.headers.get('Set-Cookie')).toContain(`${LOCALE_COOKIE}=${WebLocale.PortugueseBrazil}`);
  });

  it.each([
    ['//evil.example', '/pt-br'],
    ['https://evil.example/', '/pt-br'],
    ['/numbers', '/pt-br'],
    ['/?agent=../x', '/pt-br'],
    ['/?x=1', '/pt-br'],
  ])('POST /locale refuses the return target %s', async (returnTo, target) => {
    const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale: WebLocale.PortugueseBrazil, returnTo } });
    expect(response.headers.get('Location')).toBe(target);
  });

  it.each(['/pt-br', '/', `/pt-br?agent=${PICKED_AGENT}`, `/?ref=${REFERRAL_CODE}`, '/?agent=any'])(
    'POST /theme returns to %s',
    async (returnTo) => {
      const response = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'light', returnTo } });
      expect(response.headers.get('Location')).toBe(`${returnTo}#theme`);
      expect(response.headers.get('Set-Cookie')).toContain(`${THEME_COOKIE}=light`);
    },
  );

  it('POST /theme from the page script saves the theme and answers with no content', async () => {
    const response = await siteFetch({
      path: '/theme',
      method: 'POST',
      form: { theme: 'light', returnTo: '/' },
      headers: { 'Sec-Fetch-Mode': 'same-origin' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Location')).toBeNull();
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
    const pathCount = LOCALES.length * 3;
    expect(xml.match(/<loc>/g)).toHaveLength(pathCount);
    LOCALES.forEach((locale) => expect(xml).toContain(`<loc>${SITE_ORIGIN}${localePathOf({ locale })}</loc>`));
    expect(xml.match(new RegExp(`hreflang="pt-BR" href="${SITE_ORIGIN}/pt-br"`, 'g'))).toHaveLength(LOCALES.length);
    expect(xml.match(new RegExp(`hreflang="zh-CN" href="${SITE_ORIGIN}/zh"`, 'g'))).toHaveLength(LOCALES.length);
    expect(xml.match(new RegExp(`hreflang="x-default" href="${SITE_ORIGIN}/"`, 'g'))).toHaveLength(LOCALES.length);
  });
});

describe('every language of the site', () => {
  it.each(LOCALES)('serves %s at its own path in its own language, with the eight alternates in the head', async (locale) => {
    const path = localePathOf({ locale });
    const response = await siteFetch({ path });
    const html = await response.text();
    const profile = LOCALE_PROFILES[locale];
    expect(response.status).toBe(OK);
    expect(html).toContain(`<html lang="${profile.languageTag}"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${path}"`);
    expect(html).toContain(`<meta property="og:locale" content="${profile.openGraphLocale}"`);
    expect(html.match(/<meta property="og:locale:alternate"/g)).toHaveLength(LOCALES.length - 1);
    LOCALES.forEach((alternate) =>
      expect(html).toContain(
        `hreflang="${LOCALE_PROFILES[alternate].languageTag}" href="${SITE_ORIGIN}${localePathOf({ locale: alternate })}"`,
      ),
    );
    expect(html).toContain(`hreflang="x-default" href="${SITE_ORIGIN}/"`);
    expect(html).toContain(escapedHtml({ text: renderSiteCopy({ key: SiteCopyKey.NavigationDocs, locale }) }));
    expect(html).toContain(`data-language="${profile.turnstileLanguage}"`);
    const mediaLocale = locale === WebLocale.PortugueseBrazil ? WebLocale.PortugueseBrazil : WebLocale.EnglishUs;
    expect(html).toContain(`<meta property="og:image" content="${SITE_ORIGIN}/site/og-${mediaLocale}.png"`);
  });

  it.each(LOCALES)('answers %s with a 301 from its trailing slash', async (locale) => {
    const path = localePathOf({ locale });
    if (path === '/') return;
    const response = await siteFetch({ path: `${path}/?ref=${REFERRAL_CODE}` });
    expect(response.status).toBe(MOVED_PERMANENTLY);
    expect(response.headers.get('Location')).toBe(`${path}?ref=${REFERRAL_CODE}`);
  });

  it.each([
    ['es-MX,es;q=0.9,en;q=0.5', '/es'],
    ['de-AT,de;q=0.9', '/de'],
    ['fr-CA,fr;q=0.8', '/fr'],
    ['ja-JP,ja;q=0.9', '/ja'],
    ['ko-KR,ko;q=0.9', '/ko'],
    ['zh-CN,zh;q=0.9', '/zh'],
    ['zh-Hans-SG', '/zh'],
    ['fr;q=0.4, ja;q=0.8, en;q=0.2', '/ja'],
  ])('sends a browser that asks for %s from the root to %s, varying on the header', async (acceptLanguage, target) => {
    const response = await siteFetch({ path: '/', headers: { 'Accept-Language': acceptLanguage } });
    expect(response.status).toBe(FOUND);
    expect(response.headers.get('Location')).toBe(target);
    expect(response.headers.get('Vary')).toContain('Accept-Language');
  });

  it.each(['zh-TW', 'zh-Hant', 'it-IT,it;q=0.9', 'ja;q=0', '*'])(
    'keeps a browser that asks for %s on the English root',
    async (acceptLanguage) => {
      const response = await siteFetch({ path: '/', headers: { 'Accept-Language': acceptLanguage } });
      expect(response.status).toBe(OK);
    },
  );

  it.each(LOCALES.filter((locale) => locale !== WebLocale.EnglishUs))(
    'sends a visitor whose cookie says %s to its path',
    async (locale) => {
      const response = await siteFetch({ path: '/', headers: { Cookie: `${LOCALE_COOKIE}=${locale}` } });
      expect(response.status).toBe(FOUND);
      expect(response.headers.get('Location')).toBe(localePathOf({ locale }));
    },
  );

  it.each(LOCALES)('POST /locale to %s sets the cookie and keeps the agent and the code', async (locale) => {
    const response = await siteFetch({
      path: '/locale',
      method: 'POST',
      form: { locale, returnTo: `/?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}` },
    });
    const path = localePathOf({ locale });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`${path}?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}`);
    expect(response.headers.get('Set-Cookie')).toContain(`${LOCALE_COOKIE}=${locale}`);
  });

  it.each(LOCALES)('prices %s in the currency of its language', async (locale) => {
    const html = await (await siteFetch({ path: localePathOf({ locale }) })).text();
    const currency = locale === WebLocale.PortugueseBrazil ? 'R$' : '$';
    expect(html).toContain(currency);
    expect(html.includes('R$')).toBe(locale === WebLocale.PortugueseBrazil);
  });
});
