import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { BackofficeTheme } from '../backoffice/backoffice-theme';
import { SEE_OTHER_STATUS } from '../backoffice/backoffice-constants';
import { textFieldOf } from '../backoffice/form-fields';
import { setPreferenceCookie } from '../backoffice/preference-cookie';
import { isReferralCode } from './referral-code';
import { LOCALE_COOKIE_NAME, SITE_LANGUAGE_PARAMETER, SITE_REFERRAL_PARAMETER, THEME_COOKIE_NAME } from './site-constants';
import { pagePathOf } from './site-links';
import type { SiteEnv } from './site-env';
import { SitePath } from './site-paths';

const LOCALE_FIELD = 'locale';
const THEME_FIELD = 'theme';
const RETURN_TO_FIELD = 'returnTo';
const LOCALES: string[] = Object.values(OwnerLocale);
const THEMES: string[] = Object.values(BackofficeTheme);
const LANGUAGES: string[] = Object.values(DocsLanguage);

function returnTargetOf(input: { returnTo: string | null }): string {
  const { returnTo } = input;
  if (returnTo === null || !returnTo.startsWith(SitePath.Home)) return SitePath.Home;
  const [path, query] = returnTo.split('?');
  const parameters = new URLSearchParams(query);
  const language = parameters.get(SITE_LANGUAGE_PARAMETER);
  const code = parameters.get(SITE_REFERRAL_PARAMETER);
  const isKnownLanguage = language === null || LANGUAGES.includes(language);
  const isKnownCode = code === null || isReferralCode({ value: code });
  const target = pagePathOf({ language: language as DocsLanguage | null, referralCode: code });
  const isCanonicalTarget = path === SitePath.Home && isKnownLanguage && isKnownCode && target === returnTo;
  return isCanonicalTarget ? returnTo : SitePath.Home;
}

export const preferenceRoutes = new Hono<SiteEnv>();

preferenceRoutes.post(SitePath.Locale, async (context) => {
  const form = await context.req.parseBody();
  const locale = textFieldOf({ form, name: LOCALE_FIELD });
  if (locale !== null && LOCALES.includes(locale)) setPreferenceCookie({ context, name: LOCALE_COOKIE_NAME, value: locale });
  return context.redirect(returnTargetOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) }), SEE_OTHER_STATUS);
});

preferenceRoutes.post(SitePath.Theme, async (context) => {
  const form = await context.req.parseBody();
  const theme = textFieldOf({ form, name: THEME_FIELD });
  if (theme !== null && THEMES.includes(theme)) setPreferenceCookie({ context, name: THEME_COOKIE_NAME, value: theme });
  return context.redirect(returnTargetOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) }), SEE_OTHER_STATUS);
});
