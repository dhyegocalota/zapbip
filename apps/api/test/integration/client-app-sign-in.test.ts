import { reset } from 'cloudflare:test';
import { HttpStatus, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/adapters/platform/hash';
import { csrfTokenOf } from '../../src/client-app/csrf';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import {
  ACCOUNT,
  clientAppEnvironment,
  clientAppFetch,
  csrfOf,
  issueSignInToken,
  prepareClientAppDatabase,
  seedAccountForApp,
  SESSION_COOKIE_NAME,
  sessionCookieOf,
} from '../support/client-app';
import { testEnv } from '../support/workers-env';

const EXPIRED_COPY = 'This link expired. Send login again.';
const UNKNOWN_TOKEN = 'A'.repeat(43);
const COUNT_TOKENS_STATEMENT = 'SELECT COUNT(*) AS total FROM client_app_sign_in_tokens';
const COUNT_SESSIONS_STATEMENT = 'SELECT COUNT(*) AS total FROM client_app_sessions';
const SESSION_DIGESTS_STATEMENT = 'SELECT session_digest AS digest FROM client_app_sessions';

async function total(input: { statement: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare(input.statement).first<{ total: number }>();
  return row!.total;
}

async function continuePage(input: { token: string }): Promise<{ csrf: string; response: Response }> {
  const response = await clientAppFetch({ path: `/sign-in/${input.token}` });
  return { response, csrf: csrfOf({ html: await response.clone().text() }) };
}

beforeEach(async () => {
  await prepareClientAppDatabase();
  await seedAccountForApp({});
});
afterEach(reset);

describe('GET /sign-in/<token>', () => {
  it('shows the Continue page and never consumes the token', async () => {
    const token = await issueSignInToken({});
    const first = await clientAppFetch({ path: `/sign-in/${token}` });
    const second = await clientAppFetch({ path: `/sign-in/${token}` });
    expect([first.status, second.status]).toEqual([HttpStatus.Ok, HttpStatus.Ok]);
    expect(await first.text()).toContain(`action="/sign-in/${token}"`);
    expect(await total({ statement: COUNT_TOKENS_STATEMENT })).toBe(1);
    expect(await total({ statement: COUNT_SESSIONS_STATEMENT })).toBe(0);
  });

  it('is private and uncacheable', async () => {
    const token = await issueSignInToken({});
    const { headers } = await clientAppFetch({ path: `/sign-in/${token}` });
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('referrer-policy')).toBe('same-origin');
  });

  it('answers an unknown link with the expired page and 410', async () => {
    const response = await clientAppFetch({ path: `/sign-in/${UNKNOWN_TOKEN}` });
    expect(response.status).toBe(HttpStatus.Gone);
    expect(await response.text()).toContain(EXPIRED_COPY);
  });

  it('answers a malformed link with the expired page and 410', async () => {
    expect((await clientAppFetch({ path: '/sign-in/short' })).status).toBe(HttpStatus.Gone);
  });

  it('answers an expired link with the expired page and 410', async () => {
    const token = await issueSignInToken({ expiresAt: Date.now() - 1 });
    const response = await clientAppFetch({ path: `/sign-in/${token}` });
    expect(response.status).toBe(HttpStatus.Gone);
    expect(await response.text()).toContain(EXPIRED_COPY);
  });

  it('answers in Portuguese under the pt-br path', async () => {
    const token = await issueSignInToken({});
    const response = await clientAppFetch({ path: `/pt-br/sign-in/${token}` });
    expect(await response.text()).toContain('action="/pt-br/sign-in/');
  });
});

describe('POST /sign-in/<token>', () => {
  it('consumes the token, stores only the digest of the session and sets the cookie', async () => {
    const token = await issueSignInToken({});
    const { csrf } = await continuePage({ token });
    const response = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf } });
    const cookie = sessionCookieOf({ response });
    expect(response.status).toBe(HttpStatus.SeeOther);
    expect(response.headers.get('Location')).toBe('/');
    expect(cookie).not.toBeNull();
    expect(await total({ statement: COUNT_TOKENS_STATEMENT })).toBe(0);
    const stored = await testEnv.CONNECTIONS.prepare(SESSION_DIGESTS_STATEMENT).first<{ digest: string }>();
    expect(stored!.digest).toBe(await sha256Hex({ value: cookie! }));
  });

  it('sets a host-locked, http-only, secure, lax cookie', async () => {
    const token = await issueSignInToken({});
    const { csrf } = await continuePage({ token });
    const response = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf } });
    const header = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))!;
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//i);
    expect(header).not.toMatch(/Domain=/i);
  });

  it('refuses a second use of the same link with 410 and creates no second session', async () => {
    const token = await issueSignInToken({});
    const { csrf } = await continuePage({ token });
    await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf } });
    const again = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf } });
    expect(again.status).toBe(HttpStatus.Gone);
    expect(sessionCookieOf({ response: again })).toBeNull();
    expect(await total({ statement: COUNT_SESSIONS_STATEMENT })).toBe(1);
  });

  it('refuses an expired link with 410 and no session', async () => {
    const token = await issueSignInToken({ expiresAt: Date.now() - 1 });
    const csrf = await csrfTokenOf({ secret: token });
    const response = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf } });
    expect(response.status).toBe(HttpStatus.Gone);
    expect(await total({ statement: COUNT_SESSIONS_STATEMENT })).toBe(0);
  });

  it('refuses a wrong CSRF token with 403 and leaves the token usable', async () => {
    const token = await issueSignInToken({});
    const response = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf: 'wrong' } });
    expect(response.status).toBe(HttpStatus.Forbidden);
    expect(await total({ statement: COUNT_TOKENS_STATEMENT })).toBe(1);
  });

  it('refuses the CSRF token of another link', async () => {
    const token = await issueSignInToken({});
    const { csrf } = await continuePage({ token });
    const otherToken = await issueSignInToken({});
    const response = await clientAppFetch({ path: `/sign-in/${otherToken}`, method: 'POST', form: { csrf } });
    expect(response.status).toBe(HttpStatus.Forbidden);
  });

  it.each([null, 'https://evil.example'])('refuses the origin %s with 403 and leaves the token usable', async (origin) => {
    const token = await issueSignInToken({});
    const { csrf } = await continuePage({ token });
    const response = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf }, origin });
    expect(response.status).toBe(HttpStatus.Forbidden);
    expect(await total({ statement: COUNT_TOKENS_STATEMENT })).toBe(1);
  });

  it('answers 429 with Retry-After past the sign-in limit and leaves the token usable', async () => {
    const token = await issueSignInToken({});
    const { csrf } = await continuePage({ token });
    const env = clientAppEnvironment({ overrides: { INSTALL_PAGE_LIMITER: createFakeRateLimiter({ limit: 0 }) } });
    const response = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf }, env });
    expect(response.status).toBe(HttpStatus.TooManyRequests);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await total({ statement: COUNT_TOKENS_STATEMENT })).toBe(1);
  });

  it('sends a Portuguese account to the pt-br home', async () => {
    await reset();
    await prepareClientAppDatabase();
    await seedAccountForApp({ locale: OwnerLocale.PortugueseBrazil });
    const token = await issueSignInToken({ accountId: ACCOUNT });
    const { csrf } = await continuePage({ token });
    const response = await clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf } });
    expect(response.headers.get('Location')).toBe('/pt-br');
  });
});
