import {
  PINNED_WAKE_PROVIDER_RULES,
  WAKE_CONTENT_TYPE,
  WAKE_REQUEST_TIMEOUT_MS,
  WAKE_RETRY_AFTER_STATUSES,
  WAKE_SIGNATURE_HEADER,
  WAKE_SIGNATURE_PREFIX,
  isWakeTimeout,
  WAKE_TIMESTAMP_HEADER,
  signWakeRequest,
  type PinnedWakeProvider,
  type WakeAttemptRequest,
  type WakeAttemptResult,
  type WakeTransport,
} from '@zapbip/core';
import { SECOND_MS, WakeAttemptOutcome, WakeProvider } from '@zapbip/types';
import { encodeHex } from '../platform/encoding';

type HeaderBuilder = (input: WakeAttemptRequest) => Promise<Record<string, string>>;

const HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
const SUCCESS_STATUS_FLOOR = 200;
const SUCCESS_STATUS_CEILING = 299;
const SERVER_ERROR_FLOOR = 500;
const SERVER_ERROR_CEILING = 599;
const NOT_IMPLEMENTED_STATUS = 501;
const RETRYABLE_STATUSES: readonly number[] = [408, 425, 429];
const RETRY_AFTER_HEADER = 'retry-after';
const RETRY_AFTER_PATTERN = /^\d+$/;

function isSuccess(input: { statusCode: number }): boolean {
  return input.statusCode >= SUCCESS_STATUS_FLOOR && input.statusCode <= SUCCESS_STATUS_CEILING;
}

function isRetryable(input: { statusCode: number }): boolean {
  const { statusCode } = input;
  const isServerError = statusCode >= SERVER_ERROR_FLOOR && statusCode <= SERVER_ERROR_CEILING && statusCode !== NOT_IMPLEMENTED_STATUS;
  return isServerError || RETRYABLE_STATUSES.includes(statusCode);
}

function outcomeOf(input: { statusCode: number }): WakeAttemptOutcome {
  if (isSuccess(input)) return WakeAttemptOutcome.Delivered;
  if (isRetryable(input)) return WakeAttemptOutcome.Retry;
  return WakeAttemptOutcome.Refused;
}

function retryAfterMsOf(input: { response: Response }): number | null {
  const { response } = input;
  const header = response.headers.get(RETRY_AFTER_HEADER);
  const isHonoured = header !== null && WAKE_RETRY_AFTER_STATUSES.includes(response.status) && RETRY_AFTER_PATTERN.test(header);
  const seconds = isHonoured ? Number(header) : 0;
  return seconds > 0 ? seconds * SECOND_MS : null;
}

async function hmacHex(input: { key: string; text: string }): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(input.key), HMAC_ALGORITHM, false, ['sign']);
  const signature = await crypto.subtle.sign(HMAC_ALGORITHM.name, key, encoder.encode(input.text));
  return encodeHex({ bytes: new Uint8Array(signature) });
}

function pinnedHeaders(input: { provider: PinnedWakeProvider }): HeaderBuilder {
  return async ({ target }) => PINNED_WAKE_PROVIDER_RULES[input.provider].buildHeaders({ token: target.token });
}

const signedHeaders: HeaderBuilder = async ({ target, body, nowMs }) => {
  const timestampSeconds = Math.floor(nowMs / SECOND_MS);
  const signature = await hmacHex({ key: target.token, text: signWakeRequest({ timestampSeconds, body }) });
  return {
    'content-type': WAKE_CONTENT_TYPE,
    [WAKE_TIMESTAMP_HEADER]: String(timestampSeconds),
    [WAKE_SIGNATURE_HEADER]: `${WAKE_SIGNATURE_PREFIX}${signature}`,
  };
};

const HEADER_BUILDERS: Record<WakeProvider, HeaderBuilder> = {
  [WakeProvider.GrokRoutine]: pinnedHeaders({ provider: WakeProvider.GrokRoutine }),
  [WakeProvider.ClaudeRoutine]: pinnedHeaders({ provider: WakeProvider.ClaudeRoutine }),
  [WakeProvider.GenericWebhook]: signedHeaders,
};

async function post(input: WakeAttemptRequest): Promise<Response> {
  return fetch(input.target.url, {
    method: 'POST',
    headers: await HEADER_BUILDERS[input.target.provider](input),
    body: input.body,
    redirect: 'manual',
    signal: AbortSignal.timeout(WAKE_REQUEST_TIMEOUT_MS),
  });
}

export function createFetchWakeTransport(): WakeTransport {
  return {
    send: async (input) => {
      try {
        const response = await post(input);
        await response.body?.cancel();
        return {
          outcome: outcomeOf({ statusCode: response.status }),
          statusCode: response.status,
          retryAfterMs: retryAfterMsOf({ response }),
          timedOut: false,
        };
      } catch (error) {
        return { outcome: WakeAttemptOutcome.Retry, statusCode: null, retryAfterMs: null, timedOut: isWakeTimeout({ error }) };
      }
    },
  };
}
