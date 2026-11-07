import { afterEach, describe, expect, it } from 'vitest';
import { type FakeGraph, startFakeGraph } from '../../src/operations/fake-graph-harness';

const SEND_PATH = '/v23.0/PNID/messages';
const SEND_BODY = { messaging_product: 'whatsapp', to: '5511999990000', type: 'text', text: { body: 'hello' } };

const started: FakeGraph[] = [];

async function startGraph(): Promise<FakeGraph> {
  const graph = await startFakeGraph();
  started.push(graph);
  return graph;
}

function post(input: { graph: FakeGraph; path: string; body: unknown }): Promise<Response> {
  return fetch(`${input.graph.baseUrl}${input.path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.body),
  });
}

afterEach(async () => {
  await Promise.all(started.splice(0).map((graph) => graph.close()));
});

describe('fake graph harness', () => {
  it('listens on a loopback port it picked and returns its base url', async () => {
    const graph = await startGraph();
    expect(graph.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('answers a send with a Graph success body carrying a message id', async () => {
    const graph = await startGraph();
    const response = await post({ graph, path: SEND_PATH, body: SEND_BODY });
    const answer = (await response.json()) as { messaging_product: string; messages: { id: string }[] };
    expect(response.status).toBe(200);
    expect(answer.messaging_product).toBe('whatsapp');
    expect(answer.messages[0]?.id).toMatch(/^wamid\./);
  });

  it('gives each send a different message id and records the path and body', async () => {
    const graph = await startGraph();
    const first = (await (await post({ graph, path: SEND_PATH, body: SEND_BODY })).json()) as { messages: { id: string }[] };
    const second = (await (await post({ graph, path: SEND_PATH, body: SEND_BODY })).json()) as { messages: { id: string }[] };
    expect(first.messages[0]?.id).not.toBe(second.messages[0]?.id);
    expect(graph.sends).toEqual([
      { path: SEND_PATH, body: SEND_BODY },
      { path: SEND_PATH, body: SEND_BODY },
    ]);
  });

  it('stops listening on close', async () => {
    const graph = await startFakeGraph();
    await graph.close();
    await expect(post({ graph, path: SEND_PATH, body: SEND_BODY })).rejects.toThrow();
  });
});
