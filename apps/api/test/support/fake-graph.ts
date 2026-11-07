import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';

export type RecordedRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
};

export type FakeGraphResponse = { method: string; path: string; status: number; body: unknown };

const LOCAL_HOST = '127.0.0.1';
const CONTROL_PREFIX = '/__fake';
const REQUESTS_PATH = `${CONTROL_PREFIX}/requests`;
const RESPONSES_PATH = `${CONTROL_PREFIX}/responses`;
const RESET_PATH = `${CONTROL_PREFIX}/reset`;
const SEND_PATH_PATTERN = /^\/v\d+\.\d+\/\d+\/messages$/;
const JSON_HEADERS = { 'content-type': 'application/json' };
const FAKE_MESSAGE_ID_PREFIX = 'wamid.fake';
const GRAPH_INVALID_REQUEST_CODE = 100;
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

const sendBodySchema = z.object({ to: z.string() });
const queuedResponseSchema = z.object({ method: z.string(), path: z.string(), status: z.number(), body: z.unknown() });

function graphError(input: { message: string }): unknown {
  return { error: { code: GRAPH_INVALID_REQUEST_CODE, message: input.message } };
}

async function readBody(input: { request: IncomingMessage }): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of input.request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function flattenHeaders(input: { request: IncomingMessage }): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input.request.headers).flatMap(([name, value]): [string, string][] =>
      value === undefined ? [] : [[name, Array.isArray(value) ? value.join(', ') : value]],
    ),
  );
}

function reply(input: { response: ServerResponse; status: number; body: unknown }): void {
  input.response.writeHead(input.status, JSON_HEADERS);
  input.response.end(JSON.stringify(input.body));
}

export async function startFakeGraph(input: { port: number }): Promise<{ port: number; stop: () => Promise<void> }> {
  const { createServer } = await import('node:http');
  const recorded: RecordedRequest[] = [];
  const queued: FakeGraphResponse[] = [];
  let sentCount = 0;

  function defaultSend(request: { body: unknown; response: ServerResponse }): void {
    const parsed = sendBodySchema.safeParse(request.body);
    if (!parsed.success)
      return reply({ response: request.response, status: BAD_REQUEST_STATUS, body: graphError({ message: 'invalid message' }) });
    reply({
      response: request.response,
      status: OK_STATUS,
      body: {
        messaging_product: 'whatsapp',
        contacts: [{ input: parsed.data.to, wa_id: parsed.data.to }],
        messages: [{ id: `${FAKE_MESSAGE_ID_PREFIX}.${sentCount}` }],
      },
    });
  }

  async function handleControl(request: { request: IncomingMessage; response: ServerResponse; path: string }): Promise<void> {
    const { response } = request;
    if (request.path === REQUESTS_PATH) return reply({ response, status: OK_STATUS, body: recorded });
    if (request.path === RESET_PATH) {
      recorded.length = 0;
      queued.length = 0;
      sentCount = 0;
      return reply({ response, status: OK_STATUS, body: {} });
    }
    queued.push(queuedResponseSchema.parse(await readBody({ request: request.request })) as FakeGraphResponse);
    reply({ response, status: OK_STATUS, body: {} });
  }

  async function handleGraph(request: { request: IncomingMessage; response: ServerResponse; path: string }): Promise<void> {
    const method = request.request.method === undefined ? '' : request.request.method;
    const body = await readBody({ request: request.request });
    recorded.push({ method, path: request.path, headers: flattenHeaders({ request: request.request }), body });
    const isSend = method === 'POST' && SEND_PATH_PATTERN.test(request.path);
    if (isSend) sentCount += 1;
    const queuedAt = queued.findIndex((entry) => entry.method === method && entry.path === request.path);
    if (queuedAt >= 0) {
      const [entry] = queued.splice(queuedAt, 1);
      return reply({ response: request.response, status: entry!.status, body: entry!.body });
    }
    if (isSend) return defaultSend({ body, response: request.response });
    reply({ response: request.response, status: NOT_FOUND_STATUS, body: graphError({ message: 'unknown route' }) });
  }

  const server = createServer((incoming, response) => {
    const path = new URL(incoming.url === undefined ? '' : incoming.url, `http://${LOCAL_HOST}`).pathname;
    const handle = path.startsWith(CONTROL_PREFIX) ? handleControl : handleGraph;
    handle({ request: incoming, response, path }).catch((error: unknown) =>
      reply({ response, status: BAD_REQUEST_STATUS, body: graphError({ message: String(error) }) }),
    );
  });
  await new Promise<void>((resolve) => server.listen(input.port, LOCAL_HOST, resolve));

  return {
    port: (server.address() as AddressInfo).port,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
        server.closeAllConnections();
      }),
  };
}

export class FakeGraph {
  readonly baseUrl: string;

  constructor(input: { baseUrl: string }) {
    this.baseUrl = input.baseUrl;
  }

  async requests(): Promise<RecordedRequest[]> {
    const response = await fetch(`${this.baseUrl}${REQUESTS_PATH}`);
    return (await response.json()) as RecordedRequest[];
  }

  async respondWith(input: FakeGraphResponse): Promise<void> {
    await fetch(`${this.baseUrl}${RESPONSES_PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) });
  }

  async reset(): Promise<void> {
    await fetch(`${this.baseUrl}${RESET_PATH}`, { method: 'POST' });
  }
}
