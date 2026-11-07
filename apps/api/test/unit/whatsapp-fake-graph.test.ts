import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeGraph, startFakeGraph } from '../support/fake-graph';

const EPHEMERAL_PORT = 0;
const MESSAGES_PATH = '/v24.0/1000000000000001/messages';
const SEND_BODY = { messaging_product: 'whatsapp', to: '5511900000001', type: 'text', text: { body: 'Olá' } };

type SendResult = { messages: { id: string }[] };

let stopGraph: () => Promise<void>;
let fakeGraph: FakeGraph;
let baseUrl: string;

function send(input: { body?: unknown } = {}): Promise<Response> {
  return fetch(`${baseUrl}${MESSAGES_PATH}`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-access-token', 'content-type': 'application/json' },
    body: JSON.stringify(input.body === undefined ? SEND_BODY : input.body),
  });
}

beforeAll(async () => {
  const started = await startFakeGraph({ port: EPHEMERAL_PORT });
  stopGraph = started.stop;
  baseUrl = `http://127.0.0.1:${started.port}`;
  fakeGraph = new FakeGraph({ baseUrl });
});

afterAll(async () => {
  await stopGraph();
});

beforeEach(async () => {
  await fakeGraph.reset();
});

describe('fake Graph outbound routes', () => {
  it('answers a message send with a fresh message id', async () => {
    const first = (await (await send()).json()) as SendResult;
    const second = (await (await send()).json()) as SendResult;
    expect(first).toMatchObject({
      messaging_product: 'whatsapp',
      contacts: [{ wa_id: '5511900000001' }],
      messages: [{ id: expect.any(String) }],
    });
    expect(second.messages[0]!.id).not.toBe(first.messages[0]!.id);
  });

  it('records method, path, lowercase headers and parsed body', async () => {
    await send();
    expect(await fakeGraph.requests()).toEqual([
      {
        method: 'POST',
        path: MESSAGES_PATH,
        headers: expect.objectContaining({ authorization: 'Bearer test-access-token', 'content-type': 'application/json' }),
        body: SEND_BODY,
      },
    ]);
  });

  it('serves a registered response once, then the default again', async () => {
    const error = { error: { code: 131_047, message: 'Re-engagement message' } };
    await fakeGraph.respondWith({ method: 'POST', path: MESSAGES_PATH, status: 400, body: error });
    const refused = await send();
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual(error);
    expect((await send()).status).toBe(200);
  });

  it('serves registered responses in order', async () => {
    await fakeGraph.respondWith({ method: 'POST', path: MESSAGES_PATH, status: 500, body: {} });
    await fakeGraph.respondWith({ method: 'POST', path: MESSAGES_PATH, status: 401, body: {} });
    expect([(await send()).status, (await send()).status, (await send()).status]).toEqual([500, 401, 200]);
  });

  it('serves a registered response for any other path', async () => {
    await fakeGraph.respondWith({ method: 'GET', path: '/v24.0/media_1', status: 200, body: { url: 'https://lookaside.fbsbx.com/x' } });
    const response = await fetch(`${baseUrl}/v24.0/media_1`);
    expect(await response.json()).toEqual({ url: 'https://lookaside.fbsbx.com/x' });
  });

  it('answers 404 in the Graph error shape for an unknown route', async () => {
    const response = await fetch(`${baseUrl}/v24.0/unknown`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: expect.any(Number) } });
  });

  it('forgets requests and registered responses on reset', async () => {
    await fakeGraph.respondWith({ method: 'POST', path: MESSAGES_PATH, status: 500, body: {} });
    await send();
    await fakeGraph.reset();
    expect(await fakeGraph.requests()).toEqual([]);
    expect((await send()).status).toBe(200);
  });

  it('does not record its own control calls', async () => {
    await fakeGraph.respondWith({ method: 'POST', path: MESSAGES_PATH, status: 400, body: {} });
    await fakeGraph.requests();
    expect(await fakeGraph.requests()).toEqual([]);
  });
});
