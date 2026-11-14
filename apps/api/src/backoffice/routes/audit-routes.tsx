import { Hono } from 'hono';
import { AUDIT_PAGE_LIMIT } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { signedInPageContext } from '../page-context';
import { AuditPage, type AuditListRow } from '../views/audit';

const LIST_AUDIT_STATEMENT =
  'SELECT audit.at, audit.action, audit.target_kind, audit.target_id, audit.outcome, audit.client_address, ' +
  'audit.actor_key_id, agent_key.label AS actor_key_label FROM backoffice_audit AS audit ' +
  'LEFT JOIN backoffice_agent_keys AS agent_key ON agent_key.id = audit.actor_key_id ORDER BY audit.at DESC, audit.rowid DESC LIMIT ?';

export const auditRoutes = new Hono<BackofficeEnv>();

auditRoutes.get(BackofficePath.Audit, async (context) => {
  const { results } = await context.env.CONNECTIONS.prepare(LIST_AUDIT_STATEMENT).bind(AUDIT_PAGE_LIMIT).all<AuditListRow>();
  return context.html(<AuditPage page={await signedInPageContext({ context })} rows={results} />);
});
