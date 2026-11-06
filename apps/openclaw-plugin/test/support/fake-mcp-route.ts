import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';

const LOOPBACK_HOST = '127.0.0.1';
const OK_STATUS = 200;
const ACCEPTED_STATUS = 202;

export type FakeMcpRouteOptions = {
  status?: number;
  toolError?: string | null;
  maxTextLength?: number;
};

export type ReceivedRpc = { path: string; method: string; params: Record<string, unknown> };

export type FakeMcpRoute = {
  mcpLink: string;
  secretPath: string;
  requests: () => ReceivedRpc[];
  methods: () => string[];
  stop: () => Promise<void>;
};

export const FAKE_MESSAGE_ID = 'wamid.fake-1';
export const FAKE_MCP_SECRET = 'zb_conn_fakeroute0123456789abcdef0123456789abc';

async function readBody(input: { request: IncomingMessage }): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input.request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export async function startFakeMcpRoute(input: FakeMcpRouteOptions = {}): Promise<FakeMcpRoute> {
  const { status = OK_STATUS, toolError = null, maxTextLength = Number.POSITIVE_INFINITY } = input;
  const received: ReceivedRpc[] = [];
  const secretPath = `/c/${FAKE_MCP_SECRET}/mcp`;

  const server = createServer(async (request, response) => {
    const body = JSON.parse(await readBody({ request })) as { id?: number; method: string; params: Record<string, unknown> };
    received.push({ path: request.url as string, method: body.method, params: body.params });
    if (status !== OK_STATUS) return response.writeHead(status).end();
    if (body.id === undefined) return response.writeHead(ACCEPTED_STATUS).end();
    const text = (body.params.arguments as { text?: string } | undefined)?.text;
    const isTooLong = typeof text === 'string' && text.length > maxTextLength;
    const errorText = isTooLong ? `text: must be at most ${maxTextLength} characters` : toolError;
    const result =
      body.method === 'tools/call' && errorText !== null
        ? { isError: true, content: [{ type: 'text', text: errorText }] }
        : { content: [{ type: 'text', text: '{}' }], structuredContent: { message_id: FAKE_MESSAGE_ID, delivery: 'sent' } };
    response.writeHead(OK_STATUS, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, LOOPBACK_HOST, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    mcpLink: `http://${LOOPBACK_HOST}:${port}${secretPath}`,
    secretPath,
    requests: () => [...received],
    methods: () => received.map((entry) => entry.method),
    stop: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
