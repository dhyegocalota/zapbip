import { Hono } from 'hono';
import { RETURN_TO_FIELD, SEE_OTHER_STATUS, THEME_COOKIE_NAME } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { BackofficeTheme } from '../backoffice-theme';
import { textFieldOf } from '../form-fields';
import { setPreferenceCookie } from '../preference-cookie';
import { returnTargetOf } from '../return-target';

const THEME_FIELD = 'theme';
const THEMES: string[] = Object.values(BackofficeTheme);

export const themeRoutes = new Hono<BackofficeEnv>();

themeRoutes.post(BackofficePath.Theme, async (context) => {
  const form = await context.req.parseBody();
  const theme = textFieldOf({ form, name: THEME_FIELD });
  if (theme !== null && THEMES.includes(theme)) setPreferenceCookie({ context, name: THEME_COOKIE_NAME, value: theme });
  return context.redirect(returnTargetOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) }), SEE_OTHER_STATUS);
});
