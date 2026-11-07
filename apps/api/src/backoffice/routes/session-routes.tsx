import { WhatsAppNumberState } from '@zapbip/types';
import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';
import { deleteSession } from '../auth/sessions';
import { SEE_OTHER_STATUS, SESSION_COOKIE_NAME } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { signedInPageContext } from '../page-context';
import { HomePage, type NumberStateCounts } from '../views/home';

const COUNT_NUMBERS_BY_STATE_STATEMENT = 'SELECT state, COUNT(*) AS total FROM whatsapp_numbers GROUP BY state';
const NOTICE_QUERY = 'notice';
const EMPTY_COUNTS: NumberStateCounts = {
  [WhatsAppNumberState.Pending]: 0,
  [WhatsAppNumberState.Active]: 0,
  [WhatsAppNumberState.Closed]: 0,
  [WhatsAppNumberState.Disabled]: 0,
};

export const sessionRoutes = new Hono<BackofficeEnv>();

sessionRoutes.get(BackofficePath.Home, async (context) => {
  const { results } = await context.env.CONNECTIONS.prepare(COUNT_NUMBERS_BY_STATE_STATEMENT).all<{
    state: WhatsAppNumberState;
    total: number;
  }>();
  const counts = results.reduce<NumberStateCounts>((current, row) => ({ ...current, [row.state]: row.total }), EMPTY_COUNTS);
  return context.html(<HomePage page={await signedInPageContext({ context })} counts={counts} />);
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
