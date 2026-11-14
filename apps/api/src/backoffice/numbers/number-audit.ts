import type { Context } from 'hono';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { writeAudit } from '../audit/audit-log';
import type { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import type { BackofficeEnv } from '../backoffice-env';

export async function auditNumberAction(input: {
  context: Context<BackofficeEnv>;
  action: BackofficeAuditAction;
  outcome: BackofficeAuditOutcome;
  targetKind: BackofficeAuditTargetKind;
  targetId: string;
}): Promise<void> {
  const { context, action, outcome, targetKind, targetId } = input;
  await writeAudit({
    database: context.env.CONNECTIONS,
    entry: { now: Date.now(), action, outcome, targetKind, targetId, clientAddress: context.get('clientAddress'), actorKeyId: null },
  });
  logEvent({ event: LogEvent.BackofficeNumberChanged, numberId: targetId });
}
