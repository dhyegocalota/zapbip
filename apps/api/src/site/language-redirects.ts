import { HttpStatus, OwnerLocale } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { ACCEPT_LANGUAGE_HEADER, SAFE_METHODS } from '../backoffice/backoffice-constants';
import { setPreferenceCookie } from '../backoffice/preference-cookie';
import { LOCALE_COOKIE_NAME, PAGE_VARY, SITE_LANGUAGE_PARAMETER } from './site-constants';
import type { SiteEnv } from './site-env';
import { localeOfLanguageValue, localeOfPath, preferredLocaleOf } from './site-language';
import { pagePathOf } from './site-links';
import { SitePath } from './site-paths';

const TRAILING_SLASH_PATH = `${SitePath.PortugueseHome}/`;

function targetOf(input: { context: Context<SiteEnv>; locale: OwnerLocale }): string {
  const { context, locale } = input;
  return pagePathOf({ locale, agent: context.get('agentParameter'), referralCode: context.get('referralCode') });
}

export async function languageRedirects(context: Context<SiteEnv>, next: Next): Promise<Response | void> {
  if (!SAFE_METHODS.includes(context.req.method)) return next();
  const url = new URL(context.req.url);
  if (url.pathname === TRAILING_SLASH_PATH) return context.redirect(`${SitePath.PortugueseHome}${url.search}`, HttpStatus.MovedPermanently);
  const pathLocale = localeOfPath({ pathname: url.pathname });
  if (pathLocale === null) return next();
  const legacyLocale = localeOfLanguageValue({ value: context.req.query(SITE_LANGUAGE_PARAMETER) });
  if (legacyLocale !== null) {
    setPreferenceCookie({ context, name: LOCALE_COOKIE_NAME, value: legacyLocale });
    return context.redirect(targetOf({ context, locale: legacyLocale }), HttpStatus.MovedPermanently);
  }
  const isRoot = url.pathname === SitePath.Home;
  const preferred = preferredLocaleOf({
    cookieValue: getCookie(context, LOCALE_COOKIE_NAME),
    acceptLanguage: context.req.header(ACCEPT_LANGUAGE_HEADER),
  });
  if (!isRoot || preferred === OwnerLocale.EnglishUs) return next();
  context.header('Vary', PAGE_VARY);
  return context.redirect(targetOf({ context, locale: preferred }), HttpStatus.Found);
}
