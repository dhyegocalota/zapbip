import { BACKOFFICE_LOCKOUT_THRESHOLD } from '../../contract/constants';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome, type BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import { type FailureCounter, recordFailure } from './operator-state';

export async function registerFailure(input: {
  database: D1Database;
  now: number;
  clientAddress: string | null;
  action: BackofficeAuditAction;
  targetKind: BackofficeAuditTargetKind | null;
  targetId: string | null;
  counter: FailureCounter;
}): Promise<void> {
  const { database, now, clientAddress, action, targetKind, targetId, counter } = input;
  const failure = await recordFailure({ database, now, counter });
  await writeAudit({
    database,
    entry: { now, action, outcome: BackofficeAuditOutcome.Failed, targetKind, targetId, clientAddress, actorKeyId: null },
  });
  const justLocked = failure.failedAttempts === BACKOFFICE_LOCKOUT_THRESHOLD;
  if (!justLocked) return;
  logEvent({ event: LogEvent.BackofficeLocked });
  await writeAudit({
    database,
    entry: {
      now,
      action: BackofficeAuditAction.SignInLocked,
      outcome: BackofficeAuditOutcome.Locked,
      targetKind: null,
      targetId: null,
      clientAddress,
      actorKeyId: null,
    },
  });
}
