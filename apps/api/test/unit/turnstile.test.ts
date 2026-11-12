import { TURNSTILE_ACTION_WAITLIST_JOIN } from '@zapbip/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from '../../src/site/turnstile';
import { captureLogLines } from '../support/capture-log-lines';

const SECRET = 'turnstile-secret';
const TOKEN = 'token-from-the-widget';
const HOSTNAME = 'zapbip.com';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ACCEPTED_BODY = { success: true, hostname: HOSTNAME, action: TURNSTILE_ACTION_WAITLIST_JOIN };

function respondingWith(input: { body: unknown; status?: number }): typeof fetch {
  const { body, status = 200 } = input;
  return vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

function verify(input: { fetchImplementation: typeof fetch; token?: string }): Promise<boolean> {
  const { fetchImplementation, token = TOKEN } = input;
  return verifyTurnstileToken({ secret: SECRET, token, expectedHostname: HOSTNAME, fetchImplementation });
}

afterEach(() => vi.restoreAllMocks());

describe('verifyTurnstileToken', () => {
  it('accepts success with matching hostname and action', async () => {
    const fetchImplementation = respondingWith({ body: ACCEPTED_BODY });
    expect(await verify({ fetchImplementation })).toBe(true);
    const [url, init] = vi.mocked(fetchImplementation).mock.calls[0]!;
    expect(url).toBe(VERIFY_URL);
    expect(String((init as RequestInit).body)).toContain(`secret=${SECRET}`);
    expect(String((init as RequestInit).body)).toContain(`response=${TOKEN}`);
  });

  it('refuses a wrong hostname', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: { ...ACCEPTED_BODY, hostname: 'evil.example' } }) })).toBe(false);
  });

  it('refuses a wrong action', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: { ...ACCEPTED_BODY, action: 'login' } }) })).toBe(false);
  });

  it('refuses success false and never logs the token', async () => {
    const lines = captureLogLines();
    const body = { success: false, 'error-codes': ['invalid-input-response'] };
    expect(await verify({ fetchImplementation: respondingWith({ body }) })).toBe(false);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => line.includes(TOKEN) || line.includes(SECRET))).toEqual([]);
  });

  it('returns false when the request times out', async () => {
    const fetchImplementation = vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    }) as unknown as typeof fetch;
    expect(await verify({ fetchImplementation })).toBe(false);
  });

  it('returns false on a non-2xx answer', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: ACCEPTED_BODY, status: 500 }) })).toBe(false);
  });

  it('returns false on a malformed body', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: 'not json' }) })).toBe(false);
  });

  it('returns false on a body of the wrong shape', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: ['success'] }) })).toBe(false);
  });

  it('returns false for an empty token without a network call', async () => {
    const fetchImplementation = respondingWith({ body: ACCEPTED_BODY });
    expect(await verify({ fetchImplementation, token: '' })).toBe(false);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
