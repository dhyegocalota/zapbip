import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';
import { deleteSession } from '../auth/sessions';
import { SEE_OTHER_STATUS, SESSION_COOKIE_NAME } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { readHomeOverview } from '../home-sparklines';
import { signedInPageContext } from '../page-context';
import { HomePage } from '../views/home';

const NOTICE_QUERY = 'notice';

export const sessionRoutes = new Hono<BackofficeEnv>();

sessionRoutes.get(BackofficePath.Home, async (context) => {
  const overview = await readHomeOverview({ database: context.env.CONNECTIONS, now: Date.now() });
  return context.html(<HomePage page={await signedInPageContext({ context })} overview={overview} />);
});

sessionRoutes.post(BackofficePath.SignOut, async (context) => {
  const session = context.get('session');
  if (session === null) throw new Error('sign-out ran without a session');
  await deleteSession({ database: context.env.CONNECTIONS, digest: session.digest });
  await writeAudit({
    database: context.env.CONNECTIONS,
    entry: {
      now: Date.now(),
      action: BackofficeAuditAction.SignOut,
      outcome: BackofficeAuditOutcome.Succeeded,
      targetKind: null,
      targetId: null,
      clientAddress: context.get('clientAddress'),
    },
  });
  deleteCookie(context, SESSION_COOKIE_NAME, { secure: true, path: '/' });
  return context.redirect(`${BackofficePath.SignIn}?${NOTICE_QUERY}=${BackofficeNotice.SignedOut}`, SEE_OTHER_STATUS);
});
