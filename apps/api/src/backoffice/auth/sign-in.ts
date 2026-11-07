import { sha256Hex } from '../../adapters/platform/hash';
import type { Bindings } from '../../contract/env';
import { constantTimeEqual } from './constant-time';
import { readOperator, recordFailure, recordSuccess } from './operator-state';
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

export async function attemptSignIn(input: { env: Bindings; key: string; code: string; now: number }): Promise<SignInResult> {
  const { env, key, code, now } = input;
  const operator = await readOperator({ database: env.CONNECTIONS });
  const isKeyValid = await isBackofficeKey({ submittedKey: key, expectedDigest: env.BACKOFFICE_KEY_DIGEST });
  const step = await matchTotpStep({ secretBase32: env.BACKOFFICE_TOTP_SECRET, code, now, lastStep: operator.last_totp_step });
  if (!isKeyValid || step === null) {
    await recordFailure({ database: env.CONNECTIONS });
    return { outcome: SignInOutcome.Failed };
  }
  await recordSuccess({ database: env.CONNECTIONS, step });
  return { outcome: SignInOutcome.Succeeded, sessionToken: await createSession({ database: env.CONNECTIONS, now }) };
}
