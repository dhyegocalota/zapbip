import { DUMMY_PASSWORD_HASH, PASSWORD_SUBMIT_MAX_LENGTH } from '../../contract/constants';
import type { Bindings } from '../../contract/env';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';
import { constantTimeEqual } from './constant-time';
import { registerFailure } from './failure';
import { normalizeEmail } from './operator-email';
import {
  FailureCounter,
  isLocked,
  type OperatorRow,
  readOperator,
  recordSuccess,
  releaseExpiredLock,
  resetPasswordFailures,
} from './operator-state';
import { consumePendingSignIn, createPendingSignIn } from './pending-sign-in';
import { verifyPassword } from './password-hash';
import { createSession } from './sessions';
import { matchTotpStep } from './totp';

export enum SignInOutcome {
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export type SignInResult = { outcome: SignInOutcome.Succeeded; sessionToken: string } | { outcome: SignInOutcome.Failed };

export enum PasswordSignInOutcome {
  Accepted = 'accepted',
  Failed = 'failed',
}

export type PasswordSignInResult =
  { outcome: PasswordSignInOutcome.Accepted; pendingToken: string } | { outcome: PasswordSignInOutcome.Failed };

function storedCredentialOf(input: { operator: OperatorRow; email: string }): { isEmailKnown: boolean; storedHash: string } {
  const { email: storedEmail, password_hash: storedHash } = input.operator;
  if (storedEmail === null || storedHash === null) return { isEmailKnown: false, storedHash: DUMMY_PASSWORD_HASH };
  if (!constantTimeEqual({ left: input.email, right: storedEmail })) return { isEmailKnown: false, storedHash: DUMMY_PASSWORD_HASH };
  return { isEmailKnown: true, storedHash };
}

export async function attemptPasswordSignIn(input: {
  env: Bindings;
  email: string;
  password: string;
  now: number;
  clientAddress: string | null;
}): Promise<PasswordSignInResult> {
  const { env, password, now, clientAddress } = input;
  const database = env.CONNECTIONS;
  await releaseExpiredLock({ database, now, counter: FailureCounter.Password });
  await releaseExpiredLock({ database, now, counter: FailureCounter.Code });
  const operator = await readOperator({ database });
  const { isEmailKnown, storedHash } = storedCredentialOf({ operator, email: normalizeEmail({ value: input.email }) });
  const isPasswordSubmittable = password.length <= PASSWORD_SUBMIT_MAX_LENGTH;
  const isPasswordValid = isPasswordSubmittable && (await verifyPassword({ password, pepper: env.BACKOFFICE_PASSWORD_PEPPER, storedHash }));
  const isSignInLocked =
    isLocked({ operator, now, counter: FailureCounter.Password }) || isLocked({ operator, now, counter: FailureCounter.Code });
  if (isSignInLocked) return { outcome: PasswordSignInOutcome.Failed };
  const isPairValid = isEmailKnown && isPasswordValid;
  if (isPairValid) {
    await resetPasswordFailures({ database });
    return { outcome: PasswordSignInOutcome.Accepted, pendingToken: await createPendingSignIn({ database, now }) };
  }
  logEvent({ event: LogEvent.BackofficeSignInFailed });
  await registerFailure({
    database,
    now,
    clientAddress,
    action: BackofficeAuditAction.SignInFailed,
    targetKind: null,
    targetId: null,
    counter: FailureCounter.Password,
  });
  return { outcome: PasswordSignInOutcome.Failed };
}

export async function attemptCodeSignIn(input: {
  env: Bindings;
  pendingToken: string;
  code: string;
  now: number;
  clientAddress: string | null;
}): Promise<SignInResult> {
  const { env, pendingToken, code, now, clientAddress } = input;
  const database = env.CONNECTIONS;
  const isPendingLive = await consumePendingSignIn({ database, token: pendingToken, now });
  if (!isPendingLive) return { outcome: SignInOutcome.Failed };
  await releaseExpiredLock({ database, now, counter: FailureCounter.Code });
  const operator = await readOperator({ database });
  if (isLocked({ operator, now, counter: FailureCounter.Code })) return { outcome: SignInOutcome.Failed };
  const step = await matchTotpStep({ secretBase32: env.BACKOFFICE_TOTP_SECRET, code, now, lastStep: operator.last_totp_step });
  const isStepClaimed = step !== null && (await recordSuccess({ database, step }));
  if (!isStepClaimed) {
    logEvent({ event: LogEvent.BackofficeSignInFailed });
    await registerFailure({
      database,
      now,
      clientAddress,
      action: BackofficeAuditAction.SignInFailed,
      targetKind: null,
      targetId: null,
      counter: FailureCounter.Code,
    });
    return { outcome: SignInOutcome.Failed };
  }
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
      actorKeyId: null,
    },
  });
  return { outcome: SignInOutcome.Succeeded, sessionToken: await createSession({ database, now }) };
}
