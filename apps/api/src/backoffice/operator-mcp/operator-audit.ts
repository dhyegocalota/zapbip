import type { Bindings } from '../../contract/env';
import type { BatchAuditRecorder } from '../access/access-audit';
import { auditTargetOf } from '../access/access-batch-counts';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';

export type AgentAuditActor = { bindings: Bindings; keyId: string; clientAddress: string | null };

export function writeAgentAudit(input: {
  actor: AgentAuditActor;
  action: BackofficeAuditAction;
  outcome: BackofficeAuditOutcome;
  targetKind: BackofficeAuditTargetKind;
  targetId: string;
}): Promise<void> {
  const { actor, action, outcome, targetKind, targetId } = input;
  return writeAudit({
    database: actor.bindings.CONNECTIONS,
    entry: { now: Date.now(), action, outcome, targetKind, targetId, clientAddress: actor.clientAddress, actorKeyId: actor.keyId },
  });
}

export function agentAuditRecorder(input: { actor: AgentAuditActor }): BatchAuditRecorder {
  const { actor } = input;
  return ({ action, outcome, counts }) =>
    writeAgentAudit({ actor, action, outcome, targetKind: BackofficeAuditTargetKind.Access, targetId: auditTargetOf({ counts }) });
}
