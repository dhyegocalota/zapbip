import { OwnerLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { BackofficeTheme } from '../backoffice/backoffice-theme';
import { SEE_OTHER_STATUS } from '../backoffice/backoffice-constants';
import { textFieldOf } from '../backoffice/form-fields';
import { setPreferenceCookie } from '../backoffice/preference-cookie';
import { isReferralCode } from './referral-code';
import { LOCALE_COOKIE_NAME, SITE_REFERRAL_PARAMETER, THEME_COOKIE_NAME } from './site-constants';
import type { SiteEnv } from './site-env';
import { SitePath } from './site-paths';

const LOCALE_FIELD = 'locale';
const THEME_FIELD = 'theme';
const RETURN_TO_FIELD = 'returnTo';
const LOCALES: string[] = Object.values(OwnerLocale);
const THEMES: string[] = Object.values(BackofficeTheme);
const REFERRAL_PREFIX = `${SitePath.Home}?${SITE_REFERRAL_PARAMETER}=`;

function returnTargetOf(input: { returnTo: string | null }): string {
  const { returnTo } = input;
  const isReferralTarget =
    returnTo !== null && returnTo.startsWith(REFERRAL_PREFIX) && isReferralCode({ value: returnTo.slice(REFERRAL_PREFIX.length) });
  return isReferralTarget ? returnTo : SitePath.Home;
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
