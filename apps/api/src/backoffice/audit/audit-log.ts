import type { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from './backoffice-audit-action';

const INSERT_AUDIT_STATEMENT =
  'INSERT INTO backoffice_audit (id, at, action, target_kind, target_id, outcome, client_address) VALUES (?, ?, ?, ?, ?, ?, ?)';

export type AuditEntry = {
  now: number;
  action: BackofficeAuditAction;
  outcome: BackofficeAuditOutcome;
  targetKind: BackofficeAuditTargetKind | null;
  targetId: string | null;
  clientAddress: string | null;
};

export function prepareAuditInsert(input: { database: D1Database; entry: AuditEntry }): D1PreparedStatement {
  const { entry } = input;
  return input.database
    .prepare(INSERT_AUDIT_STATEMENT)
    .bind(crypto.randomUUID(), entry.now, entry.action, entry.targetKind, entry.targetId, entry.outcome, entry.clientAddress);
}

export async function writeAudit(input: { database: D1Database; entry: AuditEntry }): Promise<void> {
  await prepareAuditInsert(input).run();
}
