import { totpCodeAt } from '../../src/backoffice/auth/totp';
import type { Bindings } from '../../src/contract/env';
import { TOTP_PERIOD_MS } from '../../src/contract/constants';
import production from '../../src/index';
import { createExecutionContext } from 'cloudflare:test';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { applyDirectoryMigration } from '../support/seed';
import { testEnv } from '../support/workers-env';
import { BACKOFFICE_TEST_KEY, BACKOFFICE_TEST_TOTP_SECRET } from '../support/backoffice-credentials';

export const BACKOFFICE_ORIGIN = 'http://backoffice.localhost:8787';
export const CLIENT_ADDRESS = '203.0.113.7';
export const SESSION_COOKIE = '__Host-zb_bo_session';
export const CSRF_COOKIE = '__Host-zb_bo_csrf';
export const WRONG_KEY = `zb_bo_${'W'.repeat(43)}`;
export const WRONG_CODE = '000000';
export { BACKOFFICE_TEST_KEY };

const UNLIMITED = Number.MAX_SAFE_INTEGER;
const migrated = applyDirectoryMigration();

export type BackofficeRequest = {
  path: string;
  method?: string;
  form?: Record<string, string>;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  env?: Bindings;
};

export type OperatorRow = { last_totp_step: number; failed_attempts: number; locked_until: number | null };

export function backofficeEnv(input: { limiter?: RateLimit; overrides?: Partial<Bindings> }): Bindings {
  const { limiter = createFakeRateLimiter({ limit: UNLIMITED }), overrides } = input;
  return { ...testEnv, BACKOFFICE_RATE_LIMITER: limiter, ...overrides };
}

export async function resetBackoffice(): Promise<void> {
  await migrated;
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('DELETE FROM backoffice_sessions'),
    testEnv.CONNECTIONS.prepare('DELETE FROM backoffice_audit'),
    testEnv.CONNECTIONS.prepare('UPDATE backoffice_operator SET last_totp_step = 0, failed_attempts = 0, locked_until = NULL WHERE id = 1'),
  ]);
}

export function requestBackoffice(input: BackofficeRequest): Promise<Response> {
  const { path, method = 'GET', form, cookies, headers, env = backofficeEnv({}) } = input;
  const cookieHeader: Record<string, string> =
    cookies === undefined
      ? {}
      : {
          Cookie: Object.entries(cookies)
            .map(([name, value]) => `${name}=${value}`)
            .join('; '),
        };
  const request = new Request(`${BACKOFFICE_ORIGIN}${path}`, {
    method,
    headers: { 'cf-connecting-ip': CLIENT_ADDRESS, ...cookieHeader, ...headers },
    body: form === undefined ? undefined : new URLSearchParams(form),
  });
  return Promise.resolve(production.fetch(request, env, createExecutionContext()));
}

export function cookieValueOf(input: { response: Response; name: string }): string | null {
  const prefix = `${input.name}=`;
  const setCookie = input.response.headers.getSetCookie().find((line) => line.startsWith(prefix));
  if (setCookie === undefined) return null;
  return setCookie.slice(prefix.length).split(';')[0]!;
}

export async function validCode(input: { now?: number }): Promise<string> {
  const { now = Date.now() } = input;
  return totpCodeAt({ secretBase32: BACKOFFICE_TEST_TOTP_SECRET, step: Math.floor(now / TOTP_PERIOD_MS) });
}

export async function openSignInForm(input: { env?: Bindings }): Promise<{ csrf: string; response: Response }> {
  const response = await requestBackoffice({ path: '/sign-in', env: input.env });
  const csrf = cookieValueOf({ response, name: CSRF_COOKIE });
  if (csrf === null) throw new Error('the sign-in page set no csrf cookie');
  return { csrf, response };
}

export async function postSignIn(input: { key: string; code: string; env?: Bindings }): Promise<Response> {
  const { csrf } = await openSignInForm({ env: input.env });
  return requestBackoffice({
    path: '/sign-in',
    method: 'POST',
    form: { key: input.key, code: input.code, csrf },
    cookies: { [CSRF_COOKIE]: csrf },
    headers: { Origin: BACKOFFICE_ORIGIN },
    env: input.env,
  });
}

export async function signIn(input: { env?: Bindings }): Promise<{ sessionToken: string; response: Response }> {
  const response = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({}), env: input.env });
  const sessionToken = cookieValueOf({ response, name: SESSION_COOKIE });
  if (sessionToken === null) throw new Error(`sign-in did not open a session: ${response.status}`);
  return { sessionToken, response };
}

export async function readOperator(): Promise<OperatorRow> {
  const row = await testEnv.CONNECTIONS.prepare(
    'SELECT last_totp_step, failed_attempts, locked_until FROM backoffice_operator WHERE id = 1',
  ).first<OperatorRow>();
  if (row === null) throw new Error('the operator row is missing');
  return row;
}
