import { sha256Hex } from '../../adapters/platform/hash';
import { BACKOFFICE_LOCKOUT_THRESHOLD } from '../../contract/constants';
import type { Bindings } from '../../contract/env';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';
import { constantTimeEqual } from './constant-time';
import { isLocked, readOperator, recordFailure, recordSuccess, releaseExpiredLock } from './operator-state';
import { createSession } from './sessions';
import { matchTotpStep } from './totp';

export enum SignInOutcome {
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export type SignInResult = { outcome: SignInOutcome.Succeeded; sessionToken: string } | { outcome: SignInOutcome.Failed };

export async function isBackofficeKey(input: { submittedKey: string; expectedDigest: string }): Promise<boolean> {
  const submittedDigest = await sha256Hex({ value: input.submittedKey });
  return constantTimeEqual({ left: submittedDigest, right: input.expectedDigest });
}

async function failSignIn(input: { env: Bindings; now: number; clientAddress: string | null }): Promise<SignInResult> {
  const { env, now, clientAddress } = input;
  const database = env.CONNECTIONS;
  const failure = await recordFailure({ database, now });
  logEvent({ event: LogEvent.BackofficeSignInFailed });
  await writeAudit({
    database,
    entry: {
      now,
      action: BackofficeAuditAction.SignInFailed,
      outcome: BackofficeAuditOutcome.Failed,
      targetKind: null,
      targetId: null,
      clientAddress,
    },
  });
  const justLocked = failure.failedAttempts === BACKOFFICE_LOCKOUT_THRESHOLD;
  if (!justLocked) return { outcome: SignInOutcome.Failed };
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
    },
  });
  return { outcome: SignInOutcome.Failed };
}

export async function attemptSignIn(input: {
  env: Bindings;
  key: string;
  code: string;
  now: number;
  clientAddress: string | null;
}): Promise<SignInResult> {
  const { env, key, code, now, clientAddress } = input;
  const database = env.CONNECTIONS;
  await releaseExpiredLock({ database, now });
  const operator = await readOperator({ database });
  if (isLocked({ operator, now })) return { outcome: SignInOutcome.Failed };
  const isKeyValid = await isBackofficeKey({ submittedKey: key, expectedDigest: env.BACKOFFICE_KEY_DIGEST });
  const step = await matchTotpStep({ secretBase32: env.BACKOFFICE_TOTP_SECRET, code, now, lastStep: operator.last_totp_step });
  const isStepClaimed = isKeyValid && step !== null && (await recordSuccess({ database, step }));
  if (!isStepClaimed) return failSignIn({ env, now, clientAddress });
  logEvent({ event: LogEvent.BackofficeSignInSucceeded });
  await writeAudit({
    database,
    entry: {
      now,
      action: BackofficeAuditAction.SignInSucceeded,
      outcome: BackofficeAuditOutcome.Succeeded,
      targetKind: null,
      targetId: null,
      clientAddress,
    },
  });
  return { outcome: SignInOutcome.Succeeded, sessionToken: await createSession({ database, now }) };
}
