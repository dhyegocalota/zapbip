import type { Context } from 'hono';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import type { BackofficeEnv } from '../backoffice-env';
import { auditTargetOf, failedBatchCounts, type BatchCounts } from './access-batch-counts';

const TARGET_KIND = BackofficeAuditTargetKind.Access;

async function auditBatch(input: {
  context: Context<BackofficeEnv>;
  action: BackofficeAuditAction;
  outcome: BackofficeAuditOutcome;
  counts: BatchCounts;
}): Promise<void> {
  const { context, action, outcome, counts } = input;
  await writeAudit({
    database: context.env.CONNECTIONS,
    entry: {
      now: Date.now(),
      action,
      outcome,
      targetKind: TARGET_KIND,
      targetId: auditTargetOf({ counts }),
      clientAddress: context.get('clientAddress'),
    },
  });
}

type RunBatch<Result> = () => Promise<Result>;

export async function auditedBatch<Result extends { counts: BatchCounts }>(input: {
  context: Context<BackofficeEnv>;
  action: BackofficeAuditAction;
  selected: number;
  run: RunBatch<Result>;
}): Promise<Result> {
  const { context, action, selected, run } = input;
  const done = await run().catch(async (error: unknown) => {
    await auditBatch({ context, action, outcome: BackofficeAuditOutcome.Failed, counts: failedBatchCounts({ selected }) });
    throw error;
  });
  await auditBatch({ context, action, outcome: BackofficeAuditOutcome.Succeeded, counts: done.counts });
  return done;
}
