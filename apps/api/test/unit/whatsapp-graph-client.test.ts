import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGraphClient, GRAPH_NO_RESPONSE_STATUS, GraphRequestError } from '../../src/adapters/whatsapp/graph-client';
import { GRAPH_REQUEST_TIMEOUT_MS } from '../../src/adapters/whatsapp/whatsapp-constants';

const BASE_URL = 'http://127.0.0.1:4011';
const ACCESS_TOKEN = 'test-access-token';
const MESSAGES_PATH = '/1000000000000001/messages';

type FetchCall = { url: string; init: RequestInit };

function jsonResponse(input: { status: number; body: unknown }): Response {
  return new Response(JSON.stringify(input.body), { status: input.status, headers: { 'content-type': 'application/json' } });
}

function recordingFetcher(input: { respond: () => Response }): { fetcher: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return Promise.resolve(input.respond());
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

function clientOf(input: { fetcher: typeof fetch; developmentMediaOrigin?: string | null }) {
  const { developmentMediaOrigin = null } = input;
  return createGraphClient({ baseUrl: BASE_URL, accessToken: ACCESS_TOKEN, developmentMediaOrigin, fetcher: input.fetcher });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('graph client post and get', () => {
  it('AU-110 posts JSON to the versioned URL with the bearer token', async () => {
    const { fetcher, calls } = recordingFetcher({ respond: () => jsonResponse({ status: 200, body: { messages: [{ id: 'wamid.1' }] } }) });
    const body = { messaging_product: 'whatsapp' };
    const result = await clientOf({ fetcher }).post({ path: MESSAGES_PATH, body });
    expect(result).toEqual({ messages: [{ id: 'wamid.1' }] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${BASE_URL}/v24.0${MESSAGES_PATH}`);
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.body).toBe(JSON.stringify(body));
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(new Headers(calls[0]!.init.headers).get('content-type')).toBe('application/json');
  });

  it('gets the versioned URL with the bearer token', async () => {
    const { fetcher, calls } = recordingFetcher({ respond: () => jsonResponse({ status: 200, body: { url: 'https://x' } }) });
    expect(await clientOf({ fetcher }).get({ path: '/media_1' })).toEqual({ url: 'https://x' });
    expect(calls[0]!.url).toBe(`${BASE_URL}/v24.0/media_1`);
    expect(calls[0]!.init.method).toBe('GET');
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('rejects with the status and the Graph error code', async () => {
    const { fetcher } = recordingFetcher({
      respond: () => jsonResponse({ status: 400, body: { error: { code: 131_047, message: 'Re-engagement message' } } }),
    });
    const failure = clientOf({ fetcher }).post({ path: MESSAGES_PATH, body: {} });
    await expect(failure).rejects.toBeInstanceOf(GraphRequestError);
    await expect(failure).rejects.toMatchObject({ status: 400, errorCode: 131_047 });
  });

  it('carries the error user title when Graph sends one', async () => {
    const { fetcher } = recordingFetcher({
      respond: () => jsonResponse({ status: 400, body: { error: { code: 131_026, error_user_title: 'Message undeliverable' } } }),
    });
    await expect(clientOf({ fetcher }).post({ path: MESSAGES_PATH, body: {} })).rejects.toMatchObject({
      errorCode: 131_026,
      errorTitle: 'Message undeliverable',
    });
  });

  it('rejects with a null code when the error body is not Graph JSON', async () => {
    const { fetcher } = recordingFetcher({ respond: () => new Response('<html>bad gateway</html>', { status: 502 }) });
    await expect(clientOf({ fetcher }).post({ path: MESSAGES_PATH, body: {} })).rejects.toMatchObject({
      status: 502,
      errorCode: null,
      errorTitle: null,
    });
  });

  it('AU-111 rejects with no response status after the request timeout', async () => {
    const fetcher = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))),
    ) as unknown as typeof fetch;
    const failure = clientOf({ fetcher }).post({ path: MESSAGES_PATH, body: {} });
    const assertion = expect(failure).rejects.toMatchObject({ status: GRAPH_NO_RESPONSE_STATUS, errorCode: null });
    await vi.advanceTimersByTimeAsync(GRAPH_REQUEST_TIMEOUT_MS);
    await assertion;
  });

  it('rejects with no response status when the network fails', async () => {
    const fetcher = vi.fn(() => Promise.reject(new TypeError('network down'))) as unknown as typeof fetch;
    await expect(clientOf({ fetcher }).get({ path: '/media_1' })).rejects.toMatchObject({ status: GRAPH_NO_RESPONSE_STATUS });
  });
});

describe('graph client download', () => {
  it('downloads from the configured development origin and refuses it when none is configured', async () => {
    const { fetcher, calls } = recordingFetcher({ respond: () => new Response('bytes') });
    const url = `${BASE_URL}/media/image`;
    await clientOf({ fetcher })
      .download({ url })
      .catch(() => undefined);
    expect(calls).toHaveLength(0);
    await clientOf({ fetcher, developmentMediaOrigin: BASE_URL }).download({ url });
    expect(calls.map((call) => call.url)).toEqual([url]);
  });

  it('AU-112 refuses a host outside the allowlist without calling the fetcher', async () => {
    const { fetcher, calls } = recordingFetcher({ respond: () => new Response('x') });
    await expect(clientOf({ fetcher }).download({ url: 'https://evil.example.com/x' })).rejects.toThrow('evil.example.com');
    expect(calls).toHaveLength(0);
  });

  it('AU-113 sends the bearer token to an allowlisted host', async () => {
    const { fetcher, calls } = recordingFetcher({ respond: () => new Response('bytes') });
    const response = await clientOf({ fetcher }).download({ url: 'https://lookaside.fbsbx.com/x' });
    expect(await response.text()).toBe('bytes');
    expect(calls[0]!.url).toBe('https://lookaside.fbsbx.com/x');
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(calls[0]!.init.redirect).toBe('manual');
  });

  it.each([
    'https://lookaside.fbsbx.com@evil.com/x',
    'https://evil.com/.fbsbx.com/x',
    'https://evilfbsbx.com/x',
    'http://lookaside.fbsbx.com/x',
    'not a url',
  ])('refuses %s', async (url) => {
    const { fetcher, calls } = recordingFetcher({ respond: () => new Response('x') });
    await expect(clientOf({ fetcher }).download({ url })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('accepts the bare suffix host and every suffix', async () => {
    const { fetcher, calls } = recordingFetcher({ respond: () => new Response('x') });
    const client = clientOf({ fetcher });
    await client.download({ url: 'https://fbcdn.net/x' });
    await client.download({ url: 'https://scontent.xx.fbcdn.net/x' });
    await client.download({ url: 'https://mmg.whatsapp.net/x' });
    expect(calls).toHaveLength(3);
  });

  it('AU-117 returns a redirect as it is and makes no second request', async () => {
    const { fetcher, calls } = recordingFetcher({
      respond: () => new Response(null, { status: 302, headers: { location: 'https://evil.example.com/x' } }),
    });
    const response = await clientOf({ fetcher }).download({ url: 'https://lookaside.fbsbx.com/x' });
    expect(response.status).toBe(302);
    expect(calls).toHaveLength(1);
  });
});
