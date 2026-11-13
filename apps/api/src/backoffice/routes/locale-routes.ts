import { WebLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { LOCALE_COOKIE_NAME, RETURN_TO_FIELD, SEE_OTHER_STATUS } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { textFieldOf } from '../form-fields';
import { setPreferenceCookie } from '../preference-cookie';
import { returnTargetOf } from '../return-target';

const LOCALE_FIELD = 'locale';
const LOCALES: string[] = Object.values(WebLocale);

export const localeRoutes = new Hono<BackofficeEnv>();

localeRoutes.post(BackofficePath.Locale, async (context) => {
  const form = await context.req.parseBody();
  const locale = textFieldOf({ form, name: LOCALE_FIELD });
  if (locale !== null && LOCALES.includes(locale)) setPreferenceCookie({ context, name: LOCALE_COOKIE_NAME, value: locale });
  return context.redirect(returnTargetOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) }), SEE_OTHER_STATUS);
});
