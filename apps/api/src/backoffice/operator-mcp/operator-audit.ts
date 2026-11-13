import type { Bindings } from '../../contract/env';
import { BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import { auditTargetOf } from '../access/access-batch-counts';
import type { BatchAuditRecorder } from '../access/access-audit';

const INSERT_AGENT_AUDIT_STATEMENT =
  'INSERT INTO backoffice_audit (id, at, action, target_kind, target_id, outcome, client_address, actor_key_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
const TARGET_KIND = BackofficeAuditTargetKind.Access;

export function agentAuditRecorder(input: { bindings: Bindings; keyId: string; clientAddress: string | null }): BatchAuditRecorder {
  const { bindings, keyId, clientAddress } = input;
  return async ({ action, outcome, counts }) => {
    await bindings.CONNECTIONS.prepare(INSERT_AGENT_AUDIT_STATEMENT)
      .bind(crypto.randomUUID(), Date.now(), action, TARGET_KIND, auditTargetOf({ counts }), outcome, clientAddress, keyId)
      .run();
  };
}
