import { TURNSTILE_ACTION_WAITLIST_JOIN } from '@zapbip/types';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { TURNSTILE_VERIFY_TIMEOUT_MS, TURNSTILE_VERIFY_URL } from './site-constants';

const FETCH_FAILED_CODE = 'fetch_failed';
const BAD_STATUS_CODE = 'bad_status';
const MALFORMED_BODY_CODE = 'malformed_body';
const REFUSED_CODE = 'refused';

type VerifyBody = { success?: unknown; hostname?: unknown; action?: unknown };

function refuse(input: { errorCode: string }): false {
  logEvent({ event: LogEvent.SiteTurnstileFailed, errorCode: input.errorCode });
  return false;
}

export async function verifyTurnstileToken(input: {
  secret: string;
  token: string;
  expectedHostname: string;
  fetchImplementation: typeof fetch;
}): Promise<boolean> {
  const { secret, token, expectedHostname, fetchImplementation } = input;
  if (token === '') return false;
  const response = await fetchImplementation(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token }),
    signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
  }).catch(() => null);
  if (response === null) return refuse({ errorCode: FETCH_FAILED_CODE });
  if (!response.ok) return refuse({ errorCode: BAD_STATUS_CODE });
  const body = (await response.json().catch(() => null)) as VerifyBody | null;
  if (body === null || typeof body !== 'object') return refuse({ errorCode: MALFORMED_BODY_CODE });
  const isAccepted = body.success === true && body.hostname === expectedHostname && body.action === TURNSTILE_ACTION_WAITLIST_JOIN;
  if (!isAccepted) return refuse({ errorCode: REFUSED_CODE });
  return true;
}
