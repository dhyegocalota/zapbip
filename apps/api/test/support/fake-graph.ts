import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';

export type RecordedRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
};

export type FakeGraphResponse = { method: string; path: string; status: number; body: unknown; scopeId?: string };

const LOCAL_HOST = '127.0.0.1';
const CONTROL_PREFIX = '/__fake';
const REQUESTS_PATH = `${CONTROL_PREFIX}/requests`;
const RESPONSES_PATH = `${CONTROL_PREFIX}/responses`;
const RESET_PATH = `${CONTROL_PREFIX}/reset`;
const RESOURCE_IDS_QUERY = 'resourceIds';
const RESOURCE_ID_SEPARATOR = ',';
const RESOURCE_ID_PATTERN = /^\/v\d+\.\d+\/(\d+)/;
const SEND_PATH_PATTERN = /^\/v\d+\.\d+\/\d+\/messages$/;
const EXCHANGE_PATH_PATTERN = /^\/v\d+\.\d+\/oauth\/access_token$/;
const SUBSCRIBE_PATH_PATTERN = /^\/v\d+\.\d+\/\d+\/subscribed_apps$/;
const REGISTER_PATH_PATTERN = /^\/v\d+\.\d+\/(\d+)\/register$/;
const PHONE_NUMBERS_PATH_PATTERN = /^\/v\d+\.\d+\/\d+\/phone_numbers$/;
const EXCHANGE_CODE_FIELD = 'code';
const FAKE_BUSINESS_TOKEN = 'fake-business-token';
const FAKE_VERIFIED_NAME = 'zapbip test';
const DISPLAY_NUMBER_AREA_DIGITS = 4;
const JSON_HEADERS = { 'content-type': 'application/json' };
const FAKE_MESSAGE_ID_PREFIX = 'wamid.fake';
const GRAPH_INVALID_REQUEST_CODE = 100;
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

const sendBodySchema = z.object({ to: z.string() });
const resetBodySchema = z.object({ resourceIds: z.array(z.string()).optional() });
const queuedResponseSchema = z.object({
  method: z.string(),
  path: z.string(),
  status: z.number(),
  body: z.unknown(),
  scopeId: z.string().optional(),
});

function resourceIdOf(input: { path: string }): string | null {
  const match = RESOURCE_ID_PATTERN.exec(input.path);
  return match === null || match[1] === undefined ? null : match[1];
}

function scopeIdOf(input: { path: string; body: unknown }): string | null {
  if (!EXCHANGE_PATH_PATTERN.test(input.path)) return resourceIdOf({ path: input.path });
  return new URLSearchParams(String(input.body)).get(EXCHANGE_CODE_FIELD);
}

export function fakeReportedDisplayNumberOf(input: { phoneNumberId: string }): string {
  const last = input.phoneNumberId.slice(-DISPLAY_NUMBER_AREA_DIGITS);
  const first = input.phoneNumberId.slice(-2 * DISPLAY_NUMBER_AREA_DIGITS, -DISPLAY_NUMBER_AREA_DIGITS);
  return `+55 11 9${first}-${last}`;
}

function isOwned(input: { resourceId: string | null; resourceIds: string[] | null }): boolean {
  if (input.resourceIds === null) return true;
  return input.resourceId !== null && input.resourceIds.includes(input.resourceId);
}

function resourceIdsOf(input: { url: string | undefined }): string[] | null {
  const query = new URL(input.url === undefined ? '' : input.url, `http://${LOCAL_HOST}`).searchParams.get(RESOURCE_IDS_QUERY);
  return query === null ? null : query.split(RESOURCE_ID_SEPARATOR);
}

function keepUnowned(input: { entries: { resourceId: string | null }[]; scope: string[] | null }): void {
  const kept = input.entries.filter((entry) => !isOwned({ resourceId: entry.resourceId, resourceIds: input.scope }));
  input.entries.splice(0, input.entries.length, ...kept);
}

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
  const recorded: { request: RecordedRequest; resourceId: string | null }[] = [];
  const queued: (FakeGraphResponse & { resourceId: string | null })[] = [];
  const sentCounts = new Map<string, number>();

  function resourceKeyOf(input: { path: string }): string {
    const resourceId = resourceIdOf({ path: input.path });
    return resourceId === null ? input.path : resourceId;
  }

  function defaultSend(request: { body: unknown; response: ServerResponse; path: string }): void {
    const parsed = sendBodySchema.safeParse(request.body);
    if (!parsed.success)
      return reply({ response: request.response, status: BAD_REQUEST_STATUS, body: graphError({ message: 'invalid message' }) });
    reply({
      response: request.response,
      status: OK_STATUS,
      body: {
        messaging_product: 'whatsapp',
        contacts: [{ input: parsed.data.to, wa_id: parsed.data.to }],
        messages: [{ id: `${FAKE_MESSAGE_ID_PREFIX}.${sentCounts.get(resourceKeyOf({ path: request.path }))}` }],
      },
    });
  }

  function defaultPhoneNumbers(request: { response: ServerResponse }): void {
    const registeredIds = recorded.flatMap((entry) => {
      const match = REGISTER_PATH_PATTERN.exec(entry.request.path);
      return entry.request.method === 'POST' && match !== null && match[1] !== undefined ? [match[1]] : [];
    });
    const data = [...new Set(registeredIds)].map((id) => ({
      id,
      display_phone_number: fakeReportedDisplayNumberOf({ phoneNumberId: id }),
      verified_name: FAKE_VERIFIED_NAME,
    }));
    reply({ response: request.response, status: OK_STATUS, body: { data } });
  }

  async function handleControl(request: { request: IncomingMessage; response: ServerResponse; path: string }): Promise<void> {
    const { response } = request;
    if (request.path === REQUESTS_PATH) {
      const resourceIds = resourceIdsOf({ url: request.request.url });
      const owned = recorded.filter((entry) => isOwned({ resourceId: entry.resourceId, resourceIds }));
      return reply({ response, status: OK_STATUS, body: owned.map((entry) => entry.request) });
    }
    if (request.path === RESET_PATH) {
      const body = await readBody({ request: request.request });
      const { resourceIds } = resetBodySchema.parse(body === null ? {} : body);
      const scope = resourceIds === undefined ? null : resourceIds;
      keepUnowned({ entries: recorded, scope });
      keepUnowned({ entries: queued, scope });
      if (scope === null) sentCounts.clear();
      else scope.forEach((resourceId) => sentCounts.delete(resourceId));
      return reply({ response, status: OK_STATUS, body: {} });
    }
    const queuedResponse = queuedResponseSchema.parse(await readBody({ request: request.request })) as FakeGraphResponse;
    queued.push({ ...queuedResponse, resourceId: resourceIdOf({ path: queuedResponse.path }) });
    reply({ response, status: OK_STATUS, body: {} });
  }

  async function handleGraph(request: { request: IncomingMessage; response: ServerResponse; path: string }): Promise<void> {
    const method = request.request.method === undefined ? '' : request.request.method;
    const body = await readBody({ request: request.request });
    recorded.push({
      request: { method, path: request.path, headers: flattenHeaders({ request: request.request }), body },
      resourceId: scopeIdOf({ path: request.path, body }),
    });
    const isSend = method === 'POST' && SEND_PATH_PATTERN.test(request.path);
    if (isSend) {
      const key = resourceKeyOf({ path: request.path });
      const previous = sentCounts.get(key);
      sentCounts.set(key, previous === undefined ? 1 : previous + 1);
    }
    const scopeId = scopeIdOf({ path: request.path, body });
    const isQueuedFor = (entry: FakeGraphResponse) =>
      entry.method === method && entry.path === request.path && (entry.scopeId === undefined || entry.scopeId === scopeId);
    const queuedAt = queued.findIndex(isQueuedFor);
    if (queuedAt >= 0) {
      const [entry] = queued.splice(queuedAt, 1);
      return reply({ response: request.response, status: entry!.status, body: entry!.body });
    }
    if (isSend) return defaultSend({ body, response: request.response, path: request.path });
    const isExchange = method === 'POST' && EXCHANGE_PATH_PATTERN.test(request.path);
    if (isExchange)
      return reply({ response: request.response, status: OK_STATUS, body: { access_token: FAKE_BUSINESS_TOKEN, token_type: 'bearer' } });
    const isSubscribe = method === 'POST' && SUBSCRIBE_PATH_PATTERN.test(request.path);
    if (isSubscribe) return reply({ response: request.response, status: OK_STATUS, body: { success: true } });
    const isRegister = method === 'POST' && REGISTER_PATH_PATTERN.test(request.path);
    if (isRegister) return reply({ response: request.response, status: OK_STATUS, body: { success: true } });
    const isPhoneNumbers = method === 'GET' && PHONE_NUMBERS_PATH_PATTERN.test(request.path);
    if (isPhoneNumbers) return defaultPhoneNumbers({ response: request.response });
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
  private readonly resourceIds: string[] | null;

  constructor(input: { baseUrl: string; resourceIds?: string[] }) {
    this.baseUrl = input.baseUrl;
    this.resourceIds = input.resourceIds === undefined ? null : input.resourceIds;
  }

  async requests(): Promise<RecordedRequest[]> {
    const scope = this.resourceIds === null ? '' : `?${RESOURCE_IDS_QUERY}=${this.resourceIds.join(RESOURCE_ID_SEPARATOR)}`;
    const response = await fetch(`${this.baseUrl}${REQUESTS_PATH}${scope}`);
    return (await response.json()) as RecordedRequest[];
  }

  async respondWith(input: FakeGraphResponse): Promise<void> {
    await fetch(`${this.baseUrl}${RESPONSES_PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) });
  }

  async reset(): Promise<void> {
    const body = this.resourceIds === null ? {} : { resourceIds: this.resourceIds };
    await fetch(`${this.baseUrl}${RESET_PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  }
}
