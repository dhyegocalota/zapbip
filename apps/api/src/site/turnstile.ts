import { TURNSTILE_ACTION_WAITLIST_JOIN } from '@zapbip/types';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { TURNSTILE_VERIFY_TIMEOUT_MS, TURNSTILE_VERIFY_URL } from './site-constants';

export enum TurnstileVerdict {
  Accepted = 'accepted',
  Refused = 'refused',
  Unavailable = 'unavailable',
}

const FETCH_FAILED_CODE = 'fetch_failed';
const BAD_STATUS_CODE = 'bad_status';
const MALFORMED_BODY_CODE = 'malformed_body';
const REFUSED_CODE = 'refused';
const EMPTY_TOKEN_CODE = 'empty_token';

type VerifyBody = { success?: unknown; hostname?: unknown; action?: unknown };

function verdictOf(input: { verdict: TurnstileVerdict; errorCode: string }): TurnstileVerdict {
  logEvent({ event: LogEvent.SiteTurnstileFailed, errorCode: input.errorCode });
  return input.verdict;
}

export async function verifyTurnstileToken(input: {
  secret: string;
  token: string;
  expectedHostname: string;
  acceptTestingKey: boolean;
  fetchImplementation: typeof fetch;
}): Promise<TurnstileVerdict> {
  const { secret, token, expectedHostname, acceptTestingKey, fetchImplementation } = input;
  if (token === '') return verdictOf({ verdict: TurnstileVerdict.Refused, errorCode: EMPTY_TOKEN_CODE });
  const response = await fetchImplementation(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token }),
    signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
  }).catch(() => null);
  if (response === null) return verdictOf({ verdict: TurnstileVerdict.Unavailable, errorCode: FETCH_FAILED_CODE });
  if (!response.ok) return verdictOf({ verdict: TurnstileVerdict.Unavailable, errorCode: BAD_STATUS_CODE });
  const body = (await response.json().catch(() => null)) as VerifyBody | null;
  const isWellFormed = body !== null && typeof body === 'object' && typeof body.success === 'boolean';
  if (!isWellFormed) return verdictOf({ verdict: TurnstileVerdict.Unavailable, errorCode: MALFORMED_BODY_CODE });
  const isAccepted = body.success === true && body.hostname === expectedHostname && body.action === TURNSTILE_ACTION_WAITLIST_JOIN;
  if (!isAccepted) return verdictOf({ verdict: TurnstileVerdict.Refused, errorCode: REFUSED_CODE });
  return TurnstileVerdict.Accepted;
}
