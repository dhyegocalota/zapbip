import { sha256Hex } from '../../adapters/platform/hash';
import type { Bindings } from '../../contract/env';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';
import { constantTimeEqual } from './constant-time';
import { registerFailure } from './failure';
import { isLocked, readOperator, recordSuccess, releaseExpiredLock } from './operator-state';
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

async function failSignIn(input: {
  database: D1Database;
  now: number;
  clientAddress: string | null;
  isKeyValid: boolean;
}): Promise<SignInResult> {
  const { database, now, clientAddress, isKeyValid } = input;
  logEvent({ event: LogEvent.BackofficeSignInFailed });
  if (isKeyValid) {
    await registerFailure({ database, now, clientAddress, action: BackofficeAuditAction.SignInFailed, targetKind: null, targetId: null });
    return { outcome: SignInOutcome.Failed };
  }
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
  if (!isStepClaimed) return failSignIn({ database, now, clientAddress, isKeyValid });
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
