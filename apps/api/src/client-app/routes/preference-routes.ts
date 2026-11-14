import { CLIENT_APP_SIGN_IN_PATH_PREFIX, WebLocale } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { SEE_OTHER_STATUS } from '../../backoffice/backoffice-constants';
import { textFieldOf } from '../../backoffice/form-fields';
import { setPreferenceCookie } from '../../backoffice/preference-cookie';
import { RETURN_TO_FIELD } from '../../web-shell/shell-fields';
import { ShellTheme } from '../../web-shell/shell-theme';
import { SIGN_IN_TOKEN_PATTERN, THEME_COOKIE_NAME } from '../client-app-constants';
import type { ClientAppEnv } from '../client-app-env';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { isOriginTrusted, refuseSubmission } from '../session-guards';

const LOCALE_FIELD = 'locale';
const THEME_FIELD = 'theme';
const LOCALES: string[] = Object.values(WebLocale);
const THEMES: string[] = Object.values(ShellTheme);

function returnPathOf(input: { returnTo: string | null }): string {
  const { returnTo } = input;
  if (returnTo === null) return ClientAppPath.Home;
  const isSignInPage =
    returnTo.startsWith(CLIENT_APP_SIGN_IN_PATH_PREFIX) &&
    SIGN_IN_TOKEN_PATTERN.test(returnTo.slice(CLIENT_APP_SIGN_IN_PATH_PREFIX.length));
  return isSignInPage ? returnTo : ClientAppPath.Home;
}

async function changeLanguage(context: Context<ClientAppEnv>): Promise<Response> {
  if (!isOriginTrusted({ context })) return refuseSubmission({ context });
  const form = await context.req.parseBody();
  const value = textFieldOf({ form, name: LOCALE_FIELD });
  const locale = value !== null && LOCALES.includes(value) ? (value as WebLocale) : context.get('locale');
  const path = returnPathOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) });
  return context.redirect(pathWithLocale({ locale, path }), SEE_OTHER_STATUS);
}

async function changeTheme(context: Context<ClientAppEnv>): Promise<Response> {
  if (!isOriginTrusted({ context })) return refuseSubmission({ context });
  const form = await context.req.parseBody();
  const theme = textFieldOf({ form, name: THEME_FIELD });
  if (theme !== null && THEMES.includes(theme)) setPreferenceCookie({ context, name: THEME_COOKIE_NAME, value: theme });
  const path = returnPathOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) });
  return context.redirect(pathWithLocale({ locale: context.get('locale'), path }), SEE_OTHER_STATUS);
}

export function preferenceRoutes(): Hono<ClientAppEnv> {
  const routes = new Hono<ClientAppEnv>();
  routes.post(ClientAppPath.Locale, changeLanguage);
  routes.post(ClientAppPath.Theme, changeTheme);
  return routes;
}
