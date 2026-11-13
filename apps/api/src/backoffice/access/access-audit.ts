import type { Context } from 'hono';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import type { BackofficeEnv } from '../backoffice-env';
import { auditTargetOf, failedBatchCounts, type BatchCounts } from './access-batch-counts';

const TARGET_KIND = BackofficeAuditTargetKind.Access;

export type BatchAuditRecorder = (input: {
  action: BackofficeAuditAction;
  outcome: BackofficeAuditOutcome;
  counts: BatchCounts;
}) => Promise<void>;

export function contextAuditRecorder(input: { context: Context<BackofficeEnv> }): BatchAuditRecorder {
  const { context } = input;
  return ({ action, outcome, counts }) =>
    writeAudit({
      database: context.env.CONNECTIONS,
      entry: {
        now: Date.now(),
        action,
        outcome,
        targetKind: TARGET_KIND,
        targetId: auditTargetOf({ counts }),
        clientAddress: context.get('clientAddress'),
        actorKeyId: null,
      },
    });
}

type RunBatch<Result> = () => Promise<Result>;

export async function auditedBatch<Result extends { counts: BatchCounts }>(input: {
  record: BatchAuditRecorder;
  action: BackofficeAuditAction;
  selected: number;
  run: RunBatch<Result>;
}): Promise<Result> {
  const { record, action, selected, run } = input;
  const done = await run().catch(async (error: unknown) => {
    await record({ action, outcome: BackofficeAuditOutcome.Failed, counts: failedBatchCounts({ selected }) });
    throw error;
  });
  await record({ action, outcome: BackofficeAuditOutcome.Succeeded, counts: done.counts });
  return done;
}
