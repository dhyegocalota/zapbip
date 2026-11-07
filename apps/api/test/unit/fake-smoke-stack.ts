import { McpToolName } from '../../src/contract/tool-definitions';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import type { SmokeFetch } from '../../src/operations/smoke-checks';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { SIGNATURE_HEADER, signWebhookBody } from '../../src/operations/signed-webhook';
import { SmokeInput, type SmokeInputs } from '../../src/operations/smoke-inputs';

export const BASE_URL = 'https://mcp-staging.zapbip.com';
export const CONNECTION_SECRET = 'zb_conn_distinctive-connection-secret';
export const APP_SECRET = 'distinctive-app-secret';
export const VERIFY_TOKEN = 'distinctive-verify-token';
export const OWNER_PHONE = '5511999990000';
export const PLACEHOLDER_APP_SECRET = `${PLACEHOLDER_VALUE_PREFIX}META_APP_SECRET`;
export const ZERO_SIGNATURE = `sha256=${'0'.repeat(64)}`;
export const WEBHOOK_PATH = '/webhooks/whatsapp';
export const MCP_PATH = `/c/${CONNECTION_SECRET}/mcp`;
export const INPUTS: SmokeInputs = {
  [SmokeInput.BaseUrl]: BASE_URL,
  [SmokeInput.ConnectionSecret]: CONNECTION_SECRET,
  [SmokeInput.OwnerPhone]: OWNER_PHONE,
  [SmokeInput.AppSecret]: APP_SECRET,
  [SmokeInput.VerifyToken]: VERIFY_TOKEN,
  [SmokeInput.PhoneNumberId]: 'PNID',
};
export const TOOL_NAMES: string[] = Object.values(McpToolName);

export type Recorded = { method: string; pathname: string; search: URLSearchParams; body: string; headers: Headers };
export type Behavior = {
  healthStatus?: number;
  healthEnvironment?: string;
  toolNames?: string[];
  verifyStatusForWrongToken?: number;
  badSignatureStatus?: number;
  placeholderSignatureStatus?: number;
  goodSignatureStatus?: number;
  inboxAppearsAtPoll?: number;
  inboxSender?: string;
  throwOnFetch?: boolean;
};

function json(input: { body: unknown; status?: number }): Response {
  const { body, status = 200 } = input;
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function fakeStack(input: Behavior) {
  const {
    healthStatus = 200,
    healthEnvironment = DeployEnvironment.Staging,
    toolNames = TOOL_NAMES,
    verifyStatusForWrongToken = 403,
    badSignatureStatus = 401,
    placeholderSignatureStatus = 401,
    goodSignatureStatus = 200,
    inboxAppearsAtPoll = 1,
    inboxSender = 'owner',
    throwOnFetch = false,
  } = input;
  const requests: Recorded[] = [];
  let deliveredText = '';
  let inboxPolls = 0;
  const smokeFetch: SmokeFetch = async (target, init) => {
    if (throwOnFetch) throw new TypeError(`fetch failed for ${String(target)}`, { cause: { code: 'ECONNREFUSED' } });
    const url = new URL(String(target));
    const { method } = init;
    const body = init.body === undefined ? '' : init.body;
    const headers = new Headers(init.headers);
    requests.push({ method, pathname: url.pathname, search: url.searchParams, body, headers });
    if (url.pathname === '/health') return json({ body: { ok: true, environment: healthEnvironment }, status: healthStatus });
    if (url.pathname === MCP_PATH) {
      const rpc = JSON.parse(body) as { id: number; method: string; params?: { name: string } };
      if (rpc.method === 'initialize') return json({ body: { jsonrpc: '2.0', id: rpc.id, result: { capabilities: {} } } });
      if (rpc.method === 'tools/list') {
        return json({ body: { jsonrpc: '2.0', id: rpc.id, result: { tools: toolNames.map((name) => ({ name })) } } });
      }
      inboxPolls += 1;
      const arrived = deliveredText !== '' && inboxPolls >= inboxAppearsAtPoll;
      const messages = arrived ? [{ sender: inboxSender, verified: true, text: deliveredText }] : [];
      return json({ body: { jsonrpc: '2.0', id: rpc.id, result: { structuredContent: { status: 'ok', messages } } } });
    }
    if (method === 'GET') {
      const isRightToken = url.searchParams.get('hub.verify_token') === VERIFY_TOKEN;
      if (isRightToken) return new Response(url.searchParams.get('hub.challenge'), { status: 200 });
      return new Response('forbidden', { status: verifyStatusForWrongToken });
    }
    if (headers.get(SIGNATURE_HEADER) === ZERO_SIGNATURE) return new Response('unauthorized', { status: badSignatureStatus });
    if (headers.get(SIGNATURE_HEADER) === signWebhookBody({ appSecret: PLACEHOLDER_APP_SECRET, body })) {
      return new Response('placeholder', { status: placeholderSignatureStatus });
    }
    deliveredText = (JSON.parse(body) as { entry: { changes: { value: { messages: { text: { body: string } }[] } }[] }[] }).entry[0]!
      .changes[0]!.value.messages[0]!.text.body;
    return new Response('ok', { status: goodSignatureStatus });
  };
  return { smokeFetch, requests };
}

export function tokenSource(prefix = 'token'): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}${counter}`;
  };
}
