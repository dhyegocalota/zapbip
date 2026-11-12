import { TURNSTILE_ACTION_WAITLIST_JOIN } from '@zapbip/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TurnstileVerdict, verifyTurnstileToken } from '../../src/site/turnstile';
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

function verify(input: { fetchImplementation: typeof fetch; token?: string; acceptTestingKey?: boolean }): Promise<TurnstileVerdict> {
  const { fetchImplementation, token = TOKEN, acceptTestingKey = false } = input;
  return verifyTurnstileToken({ secret: SECRET, token, expectedHostname: HOSTNAME, acceptTestingKey, fetchImplementation });
}

afterEach(() => vi.restoreAllMocks());

describe('verifyTurnstileToken', () => {
  it('accepts success with matching hostname and action', async () => {
    const fetchImplementation = respondingWith({ body: ACCEPTED_BODY });
    expect(await verify({ fetchImplementation })).toBe(TurnstileVerdict.Accepted);
    const [url, init] = vi.mocked(fetchImplementation).mock.calls[0]!;
    expect(url).toBe(VERIFY_URL);
    expect(String((init as RequestInit).body)).toContain(`secret=${SECRET}`);
    expect(String((init as RequestInit).body)).toContain(`response=${TOKEN}`);
  });

  it('refuses a wrong hostname', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: { ...ACCEPTED_BODY, hostname: 'evil.example' } }) })).toBe(
      TurnstileVerdict.Refused,
    );
  });

  it('refuses a wrong action', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: { ...ACCEPTED_BODY, action: 'login' } }) })).toBe(
      TurnstileVerdict.Refused,
    );
  });

  it('refuses success false and never logs the token', async () => {
    const lines = captureLogLines();
    const body = { success: false, 'error-codes': ['invalid-input-response'] };
    expect(await verify({ fetchImplementation: respondingWith({ body }) })).toBe(TurnstileVerdict.Refused);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => line.includes(TOKEN) || line.includes(SECRET))).toEqual([]);
  });

  it('reports Unavailable when the request times out', async () => {
    const fetchImplementation = vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    }) as unknown as typeof fetch;
    expect(await verify({ fetchImplementation })).toBe(TurnstileVerdict.Unavailable);
  });

  it('reports Unavailable on a non-2xx answer', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: ACCEPTED_BODY, status: 500 }) })).toBe(TurnstileVerdict.Unavailable);
  });

  it('reports Unavailable on a malformed body', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: 'not json' }) })).toBe(TurnstileVerdict.Unavailable);
  });

  it('reports Unavailable on a body of the wrong shape', async () => {
    expect(await verify({ fetchImplementation: respondingWith({ body: ['success'] }) })).toBe(TurnstileVerdict.Unavailable);
  });

  it('refuses an empty token without a network call', async () => {
    const fetchImplementation = respondingWith({ body: ACCEPTED_BODY });
    expect(await verify({ fetchImplementation, token: '' })).toBe(TurnstileVerdict.Refused);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  describe('a result produced by a published testing key', () => {
    const testingKeyBody = { success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } };

    it('is accepted when the caller allows testing keys', async () => {
      expect(await verify({ fetchImplementation: respondingWith({ body: testingKeyBody }), acceptTestingKey: true })).toBe(
        TurnstileVerdict.Accepted,
      );
    });

    it('is refused when the caller does not allow testing keys', async () => {
      expect(await verify({ fetchImplementation: respondingWith({ body: testingKeyBody }) })).toBe(TurnstileVerdict.Refused);
    });

    it('is refused when it did not succeed, even if testing keys are allowed', async () => {
      const failing = { ...testingKeyBody, success: false };
      expect(await verify({ fetchImplementation: respondingWith({ body: failing }), acceptTestingKey: true })).toBe(
        TurnstileVerdict.Refused,
      );
    });

    it('is not claimed by a plain body that merely names the field', async () => {
      const forged = { success: true, hostname: 'evil.example', metadata: { result_with_testing_key: 'true' } };
      expect(await verify({ fetchImplementation: respondingWith({ body: forged }), acceptTestingKey: true })).toBe(
        TurnstileVerdict.Refused,
      );
    });
  });
});
