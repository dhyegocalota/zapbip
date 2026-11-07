import { OwnerLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME, SEE_OTHER_STATUS } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { textFieldOf } from '../form-fields';

const LOCALE_FIELD = 'locale';
const RETURN_TO_FIELD = 'returnTo';
const RETURN_PATHS: string[] = [BackofficePath.Home, BackofficePath.Numbers, BackofficePath.Metrics, BackofficePath.Audit];
const LOCALES: string[] = Object.values(OwnerLocale);

export const localeRoutes = new Hono<BackofficeEnv>();

localeRoutes.post(BackofficePath.Locale, async (context) => {
  const form = await context.req.parseBody();
  const locale = textFieldOf({ form, name: LOCALE_FIELD });
  const returnTo = textFieldOf({ form, name: RETURN_TO_FIELD });
  if (locale !== null && LOCALES.includes(locale)) {
    setCookie(context, LOCALE_COOKIE_NAME, locale, {
      secure: true,
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    });
  }
  const target = returnTo !== null && RETURN_PATHS.includes(returnTo) ? returnTo : BackofficePath.Home;
  return context.redirect(target, SEE_OTHER_STATUS);
});
