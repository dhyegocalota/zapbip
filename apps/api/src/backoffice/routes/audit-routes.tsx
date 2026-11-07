import { Hono } from 'hono';
import { AUDIT_PAGE_LIMIT } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { signedInPageContext } from '../page-context';
import { AuditPage, type AuditListRow } from '../views/audit';

const LIST_AUDIT_STATEMENT =
  'SELECT at, action, target_kind, target_id, outcome, client_address FROM backoffice_audit ORDER BY at DESC LIMIT ?';

export const auditRoutes = new Hono<BackofficeEnv>();

auditRoutes.get(BackofficePath.Audit, async (context) => {
  const { results } = await context.env.CONNECTIONS.prepare(LIST_AUDIT_STATEMENT).bind(AUDIT_PAGE_LIMIT).all<AuditListRow>();
  return context.html(<AuditPage page={await signedInPageContext({ context })} rows={results} />);
});
