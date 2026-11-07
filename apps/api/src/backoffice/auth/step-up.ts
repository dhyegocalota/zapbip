import type { Bindings } from '../../contract/env';
import { BackofficeAuditAction, type BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import { registerFailure } from './failure';
import { isLocked, readOperator, recordSuccess, releaseExpiredLock } from './operator-state';
import { isWithinRateLimit, RateLimitScope } from './rate-limit';
import { matchTotpStep } from './totp';

export enum StepUpOutcome {
  Accepted = 'accepted',
  Rejected = 'rejected',
  RateLimited = 'rate_limited',
}

export async function verifyStepUp(input: {
  env: Bindings;
  code: string;
  now: number;
  clientAddress: string | null;
  targetKind: BackofficeAuditTargetKind;
  targetId: string;
}): Promise<StepUpOutcome> {
  const { env, code, now, clientAddress, targetKind, targetId } = input;
  const database = env.CONNECTIONS;
  if (clientAddress === null) throw new Error('step-up ran without a client address');
  const isWithinLimit = await isWithinRateLimit({
    limiter: env.BACKOFFICE_RATE_LIMITER,
    address: clientAddress,
    scope: RateLimitScope.StepUp,
  });
  if (!isWithinLimit) return StepUpOutcome.RateLimited;
  await releaseExpiredLock({ database, now });
  const operator = await readOperator({ database });
  if (isLocked({ operator, now })) return StepUpOutcome.Rejected;
  const step = await matchTotpStep({ secretBase32: env.BACKOFFICE_TOTP_SECRET, code, now, lastStep: operator.last_totp_step });
  const isStepClaimed = step !== null && (await recordSuccess({ database, step }));
  if (isStepClaimed) return StepUpOutcome.Accepted;
  await registerFailure({ database, now, clientAddress, action: BackofficeAuditAction.StepUpFailed, targetKind, targetId });
  return StepUpOutcome.Rejected;
}
