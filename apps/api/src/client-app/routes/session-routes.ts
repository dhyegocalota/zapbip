import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { SEE_OTHER_STATUS } from '../../backoffice/backoffice-constants';
import { SESSION_COOKIE_NAME } from '../client-app-constants';
import type { ClientAppEnv } from '../client-app-env';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { trustedSubmission } from '../session-guards';
import { deleteAccountSessions } from '../sessions';

export function sessionRoutes(): Hono<ClientAppEnv> {
  const routes = new Hono<ClientAppEnv>();
  routes.post(
    ClientAppPath.SignOut,
    trustedSubmission(async ({ context, session }) => {
      await deleteAccountSessions({ database: context.env.CONNECTIONS, accountId: session.accountId });
      deleteCookie(context, SESSION_COOKIE_NAME, { secure: true, path: '/' });
      return context.redirect(pathWithLocale({ locale: context.get('locale'), path: ClientAppPath.Home }), SEE_OTHER_STATUS);
    }),
  );
  return routes;
}
