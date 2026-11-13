import { createExecutionContext } from 'cloudflare:test';
import { AccountState, OwnerLocale } from '@zapbip/types';
import { D1SignInLinks } from '../../src/adapters/d1/d1-sign-in-links';
import { createClientApp } from '../../src/client-app/client-app';
import { csrfTokenOf } from '../../src/client-app/csrf';
import { CLIENT_ADDRESS_HEADER } from '../../src/contract/constants';
import type { Bindings } from '../../src/contract/env';
import { createFakeRateLimiter } from './fake-rate-limiter';
import { applyDirectoryMigration, seedOwnerIdentity } from './seed';
import { testEnv } from './workers-env';

export const CLIENT_APP_ORIGIN = testEnv.APP_ORIGIN;
export const CLIENT_ADDRESS = '203.0.113.77';
export const SESSION_COOKIE_NAME = '__Host-zapbip_app';
export const ACCOUNT = 'acc_client_app';
export const OTHER_ACCOUNT = 'acc_client_app_other';
export const OWNER_PHONE = '5511900000051';
export const OTHER_PHONE = '5511900000052';
const UNLIMITED = Number.MAX_SAFE_INTEGER;
const TOKEN_LIFETIME_MS = 600_000;
const CSRF_FIELD_PATTERN = /name="csrf" value="([^"]+)"/;
const COOKIE_VALUE_PATTERN = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`);

export function clientAppEnvironment(input: { overrides?: Partial<Bindings> }): Bindings {
  return { ...testEnv, INSTALL_PAGE_LIMITER: createFakeRateLimiter({ limit: UNLIMITED }), ...input.overrides };
}

export type ClientAppRequest = {
  path: string;
  method?: string;
  form?: Record<string, string>;
  headers?: Record<string, string>;
  cookie?: string;
  env?: Bindings;
  origin?: string | null;
};

export function clientAppFetch(input: ClientAppRequest): Promise<Response> {
  const { path, method = 'GET', form, headers = {}, cookie, env = clientAppEnvironment({}), origin = CLIENT_APP_ORIGIN } = input;
  const isSubmission = method !== 'GET';
  const originHeaders: Record<string, string> = isSubmission && origin !== null ? { Origin: origin } : {};
  const cookieHeaders: Record<string, string> = cookie === undefined ? {} : { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` };
  const request = new Request(`${CLIENT_APP_ORIGIN}${path}`, {
    method,
    headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS, ...originHeaders, ...cookieHeaders, ...headers },
    body: form === undefined ? undefined : new URLSearchParams(form),
    redirect: 'manual',
  });
  return Promise.resolve(createClientApp().fetch(request, env, createExecutionContext()));
}

export async function seedAccountForApp(input: {
  accountId?: string;
  phone?: string;
  state?: AccountState;
  locale?: OwnerLocale;
}): Promise<string> {
  const { accountId = ACCOUNT, phone = OWNER_PHONE, state = AccountState.Active, locale = OwnerLocale.EnglishUs } = input;
  const existing = await testEnv.CONNECTIONS.prepare('SELECT 1 AS found FROM accounts WHERE id = ?').bind(accountId).first();
  if (existing === null) await seedOwnerIdentity({ accountId, phone, ownerLocale: locale });
  await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(state, accountId).run();
  return accountId;
}

export async function prepareClientAppDatabase(): Promise<void> {
  await applyDirectoryMigration();
}

export function issueSignInToken(input: { accountId?: string; expiresAt?: number }): Promise<string> {
  const { accountId = ACCOUNT, expiresAt = Date.now() + TOKEN_LIFETIME_MS } = input;
  return new D1SignInLinks({ database: testEnv.CONNECTIONS }).issue({ accountId, issuedAt: Date.now(), expiresAt });
}

export function csrfOf(input: { html: string }): string {
  return CSRF_FIELD_PATTERN.exec(input.html)![1]!;
}

export function sessionCookieOf(input: { response: Response }): string | null {
  const header = input.response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (header === undefined) return null;
  return COOKIE_VALUE_PATTERN.exec(header)![1]!;
}

export async function signIn(input: { accountId?: string; phone?: string; state?: AccountState; locale?: OwnerLocale }): Promise<{
  cookie: string;
  csrf: string;
  accountId: string;
}> {
  const accountId = await seedAccountForApp(input);
  const token = await issueSignInToken({ accountId });
  const page = await clientAppFetch({ path: `/sign-in/${token}` });
  const continued = await clientAppFetch({
    path: `/sign-in/${token}`,
    method: 'POST',
    form: { csrf: csrfOf({ html: await page.text() }) },
  });
  const cookie = sessionCookieOf({ response: continued });
  if (cookie === null) throw new Error(`sign-in did not set the session cookie: ${continued.status}`);
  const home = await clientAppFetch({ path: continued.headers.get('Location')!, cookie });
  return { cookie, csrf: csrfOf({ html: await home.text() }), accountId };
}

export async function signInAgain(input: { accountId?: string; cookie?: string }): Promise<{ cookie: string; response: Response }> {
  const { accountId = ACCOUNT, cookie } = input;
  const token = await issueSignInToken({ accountId });
  const response = await clientAppFetch({
    path: `/sign-in/${token}`,
    method: 'POST',
    form: { csrf: await csrfTokenOf({ secret: token }) },
    cookie,
  });
  const next = sessionCookieOf({ response });
  if (next === null) throw new Error(`sign-in did not set the session cookie: ${response.status}`);
  return { cookie: next, response };
}
