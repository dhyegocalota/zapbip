import { createHmac } from 'node:crypto';
import { WAKE_REQUEST_TIMEOUT_MS, WAKE_SIGNAL_BODY, signWakeRequest, type WakeAttemptResult, type WakeTarget } from '@zapbip/core';
import { SECOND_MS, WakeAttemptOutcome, WakeProvider } from '@zapbip/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchWakeTransport } from '../../src/adapters/wake/fetch-wake-transport';

const AGENT = 'alpha';
const TOKEN = 'token-with-sixteen-chars';
const GENERIC_TOKEN = 'generic-token-with-thirty-two-chars';
const GROK_TARGET: WakeTarget = {
  provider: WakeProvider.GrokRoutine,
  url: 'https://api2.cursor.sh/automations/webhook/abc12345',
  token: TOKEN,
};
const CLAUDE_TARGET: WakeTarget = {
  provider: WakeProvider.ClaudeRoutine,
  url: 'https://api.anthropic.com/v1/claude_code/routines/trig_abc123/fire',
  token: TOKEN,
};
const GENERIC_TARGET: WakeTarget = { provider: WakeProvider.GenericWebhook, url: 'https://hooks.example.com/wake', token: GENERIC_TOKEN };
const GENERIC_NOW_MS = 1_767_225_600_500;
const GENERIC_TIMESTAMP_SECONDS = 1_767_225_600;
const NOW_MS = 1_800_000_000_000;
const RETRY_AFTER_SECONDS = 120;
const REDIRECT_STATUS = 301;

function respond(input: { status: number; headers?: Record<string, string> }) {
  const fetchSpy = vi.fn(async (..._arguments: unknown[]) => new Response(null, { status: input.status, headers: input.headers }));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

function send(input: { target?: WakeTarget; nowMs?: number }): Promise<WakeAttemptResult> {
  return createFetchWakeTransport().send({
    agent: AGENT,
    target: input.target === undefined ? GROK_TARGET : input.target,
    body: WAKE_SIGNAL_BODY,
    nowMs: input.nowMs === undefined ? NOW_MS : input.nowMs,
  });
}

function sentRequest(input: { fetchSpy: ReturnType<typeof respond> }) {
  const [url, init] = input.fetchSpy.mock.calls[0] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

function signatureOf(input: { body: string }): string {
  const signingString = signWakeRequest({ timestampSeconds: GENERIC_TIMESTAMP_SECONDS, body: input.body });
  return `sha256=${createHmac('sha256', GENERIC_TOKEN).update(signingString).digest('hex')}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createFetchWakeTransport requests', () => {
  it('posts the signal to a Grok target with a bearer token and no signature headers', async () => {
    const fetchSpy = respond({ status: 200 });
    await send({});
    const { url, init, headers } = sentRequest({ fetchSpy });
    expect(url).toBe(GROK_TARGET.url);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.body).toBe(WAKE_SIGNAL_BODY);
    expect(headers).toEqual({ authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' });
  });

  it('adds the routine headers to a Claude target', async () => {
    const fetchSpy = respond({ status: 200 });
    await send({ target: CLAUDE_TARGET });
    const { headers } = sentRequest({ fetchSpy });
    expect(headers).toEqual({
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'anthropic-version': '2023-06-01',
    });
  });

  it('signs a generic target with the timestamp and the body, and sends no bearer token', async () => {
    const fetchSpy = respond({ status: 200 });
    await send({ target: GENERIC_TARGET, nowMs: GENERIC_NOW_MS });
    const { headers } = sentRequest({ fetchSpy });
    expect(headers).toEqual({
      'content-type': 'application/json',
      'X-Zapbip-Timestamp': String(GENERIC_TIMESTAMP_SECONDS),
      'X-Zapbip-Signature': signatureOf({ body: WAKE_SIGNAL_BODY }),
    });
  });

  it('binds the generic signature to the body', async () => {
    const fetchSpy = respond({ status: 200 });
    await send({ target: GENERIC_TARGET, nowMs: GENERIC_NOW_MS });
    const { headers } = sentRequest({ fetchSpy });
    expect(headers['X-Zapbip-Signature']).not.toBe(signatureOf({ body: '{"event":"tampered"}' }));
  });

  it('times the request out after the request timeout', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    respond({ status: 200 });
    await send({});
    expect(timeoutSpy).toHaveBeenCalledWith(WAKE_REQUEST_TIMEOUT_MS);
  });
});

describe('createFetchWakeTransport outcomes', () => {
  it.each([200, 201, 204])('delivers on %i', async (status) => {
    respond({ status });
    expect(await send({})).toEqual({ outcome: WakeAttemptOutcome.Delivered, statusCode: status, retryAfterMs: null, timedOut: false });
  });

  it('refuses a redirect without following it', async () => {
    const fetchSpy = respond({ status: REDIRECT_STATUS, headers: { location: 'http://localhost/x' } });
    const result = await send({});
    expect(result.outcome).toBe(WakeAttemptOutcome.Refused);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 404, 501])('refuses on %i', async (status) => {
    respond({ status });
    expect((await send({})).outcome).toBe(WakeAttemptOutcome.Refused);
  });

  it.each([408, 425, 429, 500, 503, 599])('retries on %i', async (status) => {
    respond({ status });
    expect((await send({})).outcome).toBe(WakeAttemptOutcome.Retry);
  });

  it.each([429, 503])('honours an integer Retry-After on %i', async (status) => {
    respond({ status, headers: { 'retry-after': String(RETRY_AFTER_SECONDS) } });
    expect((await send({})).retryAfterMs).toBe(RETRY_AFTER_SECONDS * SECOND_MS);
  });

  it.each(['0', '-5'])('ignores a Retry-After of %s', async (value) => {
    respond({ status: 429, headers: { 'retry-after': value } });
    expect((await send({})).retryAfterMs).toBeNull();
  });

  it('ignores a Retry-After date', async () => {
    respond({ status: 503, headers: { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' } });
    expect((await send({})).retryAfterMs).toBeNull();
  });

  it('ignores a Retry-After that is not a number', async () => {
    respond({ status: 429, headers: { 'retry-after': 'abc' } });
    expect((await send({})).retryAfterMs).toBeNull();
  });

  it('ignores Retry-After on a server error other than 503', async () => {
    respond({ status: 500, headers: { 'retry-after': String(RETRY_AFTER_SECONDS) } });
    expect((await send({})).retryAfterMs).toBeNull();
  });

  it('retries without a status when the request times out', async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')));
            controller.abort();
          }),
      ),
    );
    expect(await send({})).toEqual({ outcome: WakeAttemptOutcome.Retry, statusCode: null, retryAfterMs: null, timedOut: true });
  });

  it.each(['TimeoutError', 'AbortError'])('reports timedOut when the signal fires with %s', async (name) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', name)));
    expect((await send({})).timedOut).toBe(true);
  });

  it('retries without leaking the error message when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`getaddrinfo ENOTFOUND ${GENERIC_TARGET.url}`)));
    const result = await send({});
    expect(result).toEqual({ outcome: WakeAttemptOutcome.Retry, statusCode: null, retryAfterMs: null, timedOut: false });
    expect(JSON.stringify(result)).not.toContain('ENOTFOUND');
  });
});
