import type { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';

export type AuditPageRow = {
  at: number;
  action: BackofficeAuditAction;
  targetKind: string | null;
  targetId: string | null;
  outcome: BackofficeAuditOutcome;
  actorKeyId: string | null;
};

const LIST_AUDIT_STATEMENT =
  'SELECT at, action, target_kind AS targetKind, target_id AS targetId, outcome, actor_key_id AS actorKeyId FROM backoffice_audit ORDER BY at DESC, rowid DESC LIMIT ?';

export async function listAuditPage(input: { database: D1Database; limit: number }): Promise<AuditPageRow[]> {
  const { results } = await input.database.prepare(LIST_AUDIT_STATEMENT).bind(input.limit).all<AuditPageRow>();
  return results;
}
