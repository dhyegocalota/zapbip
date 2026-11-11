import { vi } from 'vitest';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { TOTP_PERIOD_MS } from '../../src/contract/constants';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { testEnv } from '../support/workers-env';
import {
  backofficeEnv,
  BACKOFFICE_ORIGIN,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  signIn,
  validCode,
} from './backoffice-auth-fixtures';

export const NOW = Date.UTC(2026, 10, 7, 12);
export const ACCESS_TOKEN = 'registered-access-token-ta';
export const PHONE_NUMBER_ID = '1000000000555';
export const WABA_ID = '3000000000555';
export const DISPLAY_NUMBER = '+5511955550000';

type Fields = Record<string, string>;
type BackofficeBindings = ReturnType<typeof backofficeEnv>;

async function clearRegistry(): Promise<void> {
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('DELETE FROM accounts'),
    testEnv.CONNECTIONS.prepare('DELETE FROM whatsapp_numbers'),
    testEnv.CONNECTIONS.prepare('DELETE FROM meta_apps'),
    testEnv.CONNECTIONS.prepare('DELETE FROM channel_restrictions'),
  ]);
}

export async function startBackofficeSession(): Promise<string> {
  await resetBackoffice();
  await clearRegistry();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const { sessionToken } = await signIn({});
  return sessionToken;
}

export function endBackofficeSession(): void {
  vi.useRealTimers();
}

export async function nextCode(): Promise<string> {
  vi.setSystemTime(Date.now() + TOTP_PERIOD_MS);
  return validCode({ now: Date.now() });
}

export function getPage(input: { path: string; sessionToken: string; env?: BackofficeBindings }): Promise<Response> {
  return requestBackoffice({ path: input.path, cookies: { [SESSION_COOKIE]: input.sessionToken }, env: input.env });
}

export async function postAction(input: {
  path: string;
  sessionToken: string;
  fields: Fields;
  code?: string;
  origin?: string;
  env?: BackofficeBindings;
}): Promise<Response> {
  const { origin = BACKOFFICE_ORIGIN } = input;
  const code = input.code === undefined ? await nextCode() : input.code;
  const csrf = await csrfTokenOf({ sessionToken: input.sessionToken });
  return requestBackoffice({
    path: input.path,
    method: 'POST',
    form: { ...input.fields, [NumberFormField.Code]: code, [NumberFormField.Csrf]: csrf },
    cookies: { [SESSION_COOKIE]: input.sessionToken },
    headers: { Origin: origin },
    env: input.env,
  });
}

export async function submitRejectedAction(input: Parameters<typeof postAction>[0]): Promise<{ posted: Response; followed: Response }> {
  const posted = await postAction(input);
  const location = posted.headers.get('Location');
  if (location === null) throw new Error(`the rejected form answered ${posted.status} without a Location`);
  const followed = await getPage({ path: location, sessionToken: input.sessionToken, env: input.env });
  return { posted, followed };
}

export function refusingStepUpEnv(): BackofficeBindings {
  return backofficeEnv({ limiter: createFakeRateLimiter({ limit: 0 }) });
}

export async function countRows(input: { table: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare(`SELECT COUNT(*) AS total FROM ${input.table}`).first<{ total: number }>();
  if (row === null) throw new Error('count row is missing');
  return row.total;
}

export async function stateOf(input: { numberId: string }): Promise<string> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT state FROM whatsapp_numbers WHERE id = ?')
    .bind(input.numberId)
    .first<{ state: string }>();
  if (row === null) throw new Error('number row is missing');
  return row.state;
}

export function numberIdOf(input: { response: Response }): string {
  const location = input.response.headers.get('Location');
  if (location === null) throw new Error('the response has no Location');
  const match = /^\/numbers\/([^/?]+)/.exec(location);
  if (match === null || match[1] === undefined) throw new Error(`unexpected Location ${location}`);
  return match[1];
}
