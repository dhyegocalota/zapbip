import { MessageSender } from '@zapbip/types';
import { z } from 'zod';
import { HEALTH_PATH, WHATSAPP_WEBHOOK_PATH } from '../contract/constants';
import { McpToolName } from '../contract/tool-definitions';
import { HttpStatus } from '../routes/http-status';
import { PLACEHOLDER_VALUE_PREFIX, SMOKE_POLL_ATTEMPTS, SMOKE_POLL_INTERVAL_MS } from './constants';
import { buildSignedWebhookPost, SIGNATURE_HEADER, signWebhookBody } from './signed-webhook';
import { SmokeCheck, SmokeInput, type SmokeInputs, type SmokeScope, smokeChecksFor } from './smoke-inputs';

const SMOKE_TEXT_PREFIX = '@smoke ';
const WRONG_VERIFY_TOKEN = 'zapbip-smoke-wrong-token';
const PLACEHOLDER_APP_SECRET = `${PLACEHOLDER_VALUE_PREFIX}SMOKE_META_APP_SECRET`;
const ZERO_SIGNATURE = `sha256=${'0'.repeat(64)}`;
const EMPTY_JSON_BODY = '{}';
const REQUEST_FAILED_STATUS = 0;
const UNKNOWN_FAILURE_KIND = 'unknown error';
const TRAILING_SLASHES = /\/+$/;
const STATUS_DIGITS = 3;
const MCP_PROTOCOL_VERSION = '2025-06-18';
const MCP_CLIENT_NAME = 'zapbip-smoke';
const MCP_CLIENT_VERSION = '0.0.0';
const JSON_RPC_VERSION = '2.0';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const MCP_HEADERS = { ...JSON_HEADERS, Accept: 'application/json, text/event-stream' };
const REFUSAL_STATUSES: number[] = [HttpStatus.Unauthorized, HttpStatus.Forbidden];

export type SmokeRequest = { method: string; headers?: Record<string, string>; body?: string };
export type SmokeFetch = (target: string, init: SmokeRequest) => Promise<Response>;
export const GET_REQUEST: SmokeRequest = { method: 'GET' };

export type SmokeResult = { check: SmokeCheck; passed: boolean; status: number; detail: string | null };

export type SmokeRun = SmokeScope & {
  inputs: SmokeInputs;
  smokeFetch: SmokeFetch;
  wait: (input: { ms: number }) => Promise<void>;
  randomToken: () => string;
  nowSeconds: () => number;
};

type Outcome = Omit<SmokeResult, 'check'>;

enum SmokeVerdict {
  Pass = 'PASS',
  Fail = 'FAIL',
}

const causeSchema = z.object({ code: z.string() });
const healthSchema = z.object({ ok: z.literal(true), environment: z.string() });
const toolListSchema = z.object({ result: z.object({ tools: z.array(z.object({ name: z.string() })) }) });
const inboxSchema = z.object({
  result: z.object({
    structuredContent: z.object({
      messages: z.array(z.object({ sender: z.string(), verified: z.boolean(), text: z.string().nullable() })),
    }),
  }),
});

function pass(input: { status: number }): Outcome {
  return { passed: true, status: input.status, detail: null };
}

function fail(input: { status: number; detail: string }): Outcome {
  return { passed: false, status: input.status, detail: input.detail };
}

function inputOf(input: { run: SmokeRun; name: SmokeInput }): string {
  const value = input.run.inputs[input.name];
  if (value === undefined) throw new Error(`${input.name} is not set`);
  return value;
}

function urlOf(input: { run: SmokeRun; path: string }): string {
  const baseUrl = inputOf({ run: input.run, name: SmokeInput.BaseUrl }).replace(TRAILING_SLASHES, '');
  return `${baseUrl}${input.path}`;
}

function verifyUrlOf(input: { run: SmokeRun; token: string; challenge: string }): string {
  const query = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': input.token, 'hub.challenge': input.challenge });
  return urlOf({ run: input.run, path: `${WHATSAPP_WEBHOOK_PATH}?${query}` });
}

async function callMcp(input: { run: SmokeRun; id: number; method: string; params: unknown }): Promise<Response> {
  const secret = inputOf({ run: input.run, name: SmokeInput.ConnectionSecret });
  return input.run.smokeFetch(urlOf({ run: input.run, path: `/c/${secret}/mcp` }), {
    method: 'POST',
    headers: MCP_HEADERS,
    body: JSON.stringify({ jsonrpc: JSON_RPC_VERSION, id: input.id, method: input.method, params: input.params }),
  });
}

async function checkHealth(run: SmokeRun): Promise<Outcome> {
  const response = await run.smokeFetch(urlOf({ run, path: HEALTH_PATH }), GET_REQUEST);
  if (response.status !== HttpStatus.Ok) return fail({ status: response.status, detail: 'expected status 200' });
  const body = healthSchema.safeParse(await response.json());
  if (!body.success) return fail({ status: response.status, detail: 'unexpected health body' });
  if (body.data.environment !== run.environment)
    return fail({ status: response.status, detail: `environment is ${body.data.environment}` });
  return pass({ status: response.status });
}

async function checkMcpInitialize(run: SmokeRun): Promise<Outcome> {
  const params = {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: MCP_CLIENT_NAME, version: MCP_CLIENT_VERSION },
  };
  const initialized = await callMcp({ run, id: 1, method: 'initialize', params });
  if (initialized.status !== HttpStatus.Ok) return fail({ status: initialized.status, detail: 'initialize was refused' });
  const listed = await callMcp({ run, id: 2, method: 'tools/list', params: {} });
  if (listed.status !== HttpStatus.Ok) return fail({ status: listed.status, detail: 'tools/list was refused' });
  const names = toolListSchema.parse(await listed.json()).result.tools.map((tool) => tool.name);
  const missing = Object.values(McpToolName).filter((name) => !names.includes(name));
  if (missing.length > 0) return fail({ status: listed.status, detail: `missing tools: ${missing.join(', ')}` });
  return pass({ status: listed.status });
}

async function checkWebhookVerify(run: SmokeRun): Promise<Outcome> {
  const challenge = run.randomToken();
  const accepted = await run.smokeFetch(
    verifyUrlOf({ run, token: inputOf({ run, name: SmokeInput.VerifyToken }), challenge }),
    GET_REQUEST,
  );
  if (accepted.status !== HttpStatus.Ok) return fail({ status: accepted.status, detail: 'the verify token was refused' });
  if ((await accepted.text()) !== challenge) return fail({ status: accepted.status, detail: 'the challenge was not echoed' });
  const refused = await run.smokeFetch(verifyUrlOf({ run, token: WRONG_VERIFY_TOKEN, challenge }), GET_REQUEST);
  if (!REFUSAL_STATUSES.includes(refused.status)) return fail({ status: refused.status, detail: 'a wrong verify token was accepted' });
  return pass({ status: accepted.status });
}

async function checkSignatureRejected(run: SmokeRun): Promise<Outcome> {
  const response = await run.smokeFetch(urlOf({ run, path: WHATSAPP_WEBHOOK_PATH }), {
    method: 'POST',
    headers: { ...JSON_HEADERS, [SIGNATURE_HEADER]: ZERO_SIGNATURE },
    body: EMPTY_JSON_BODY,
  });
  if (!REFUSAL_STATUSES.includes(response.status)) return fail({ status: response.status, detail: 'a wrong signature was accepted' });
  const placeholderSigned = await run.smokeFetch(urlOf({ run, path: WHATSAPP_WEBHOOK_PATH }), {
    method: 'POST',
    headers: { ...JSON_HEADERS, [SIGNATURE_HEADER]: signWebhookBody({ appSecret: PLACEHOLDER_APP_SECRET, body: EMPTY_JSON_BODY }) },
    body: EMPTY_JSON_BODY,
  });
  if (!REFUSAL_STATUSES.includes(placeholderSigned.status)) {
    return fail({ status: placeholderSigned.status, detail: 'a body signed with the placeholder app secret was accepted' });
  }
  return pass({ status: response.status });
}

async function inboxHoldsOwnerMessage(input: { run: SmokeRun; text: string }): Promise<boolean> {
  const response = await callMcp({ run: input.run, id: 3, method: 'tools/call', params: { name: McpToolName.CheckInbox, arguments: {} } });
  const { messages } = inboxSchema.parse(await response.json()).result.structuredContent;
  return messages.some((message) => message.text === input.text && message.sender === MessageSender.Owner && message.verified);
}

async function pollInbox(input: { run: SmokeRun; text: string; attempt: number }): Promise<boolean> {
  const { run, text, attempt } = input;
  if (attempt > SMOKE_POLL_ATTEMPTS) return false;
  if (attempt > 1) await run.wait({ ms: SMOKE_POLL_INTERVAL_MS });
  if (await inboxHoldsOwnerMessage({ run, text })) return true;
  return pollInbox({ run, text, attempt: attempt + 1 });
}

async function checkFakeInbound(run: SmokeRun): Promise<Outcome> {
  const nonce = run.randomToken();
  const text = `${SMOKE_TEXT_PREFIX}${nonce}`;
  const post = buildSignedWebhookPost({
    appSecret: inputOf({ run, name: SmokeInput.AppSecret }),
    ownerWaId: inputOf({ run, name: SmokeInput.OwnerPhone }),
    phoneNumberId: inputOf({ run, name: SmokeInput.PhoneNumberId }),
    text,
    nonce,
    timestamp: String(run.nowSeconds()),
  });
  const response = await run.smokeFetch(urlOf({ run, path: WHATSAPP_WEBHOOK_PATH }), {
    method: 'POST',
    headers: post.headers,
    body: post.body,
  });
  if (response.status !== HttpStatus.Ok) return fail({ status: response.status, detail: 'the signed webhook was refused' });
  if (await pollInbox({ run, text, attempt: 1 })) return pass({ status: response.status });
  return fail({ status: response.status, detail: `the message never reached the inbox after ${SMOKE_POLL_ATTEMPTS} attempts` });
}

const CHECKS: Record<SmokeCheck, (run: SmokeRun) => Promise<Outcome>> = {
  [SmokeCheck.Health]: checkHealth,
  [SmokeCheck.McpInitialize]: checkMcpInitialize,
  [SmokeCheck.WebhookVerify]: checkWebhookVerify,
  [SmokeCheck.SignatureRejected]: checkSignatureRejected,
  [SmokeCheck.FakeInbound]: checkFakeInbound,
};

function failureKindOf(input: { error: unknown }): string {
  const cause = causeSchema.safeParse(input.error instanceof Error ? input.error.cause : undefined);
  if (cause.success) return cause.data.code;
  if (input.error instanceof Error) return input.error.name;
  return UNKNOWN_FAILURE_KIND;
}

async function runCheck(input: { run: SmokeRun; check: SmokeCheck }): Promise<SmokeResult> {
  try {
    return { check: input.check, ...(await CHECKS[input.check](input.run)) };
  } catch (error: unknown) {
    const detail = `request failed: ${failureKindOf({ error })}`;
    return { check: input.check, ...fail({ status: REQUEST_FAILED_STATUS, detail }) };
  }
}

async function runInOrder(input: { run: SmokeRun; checks: SmokeCheck[]; results: SmokeResult[] }): Promise<SmokeResult[]> {
  const { run, checks, results } = input;
  const [check, ...remaining] = checks;
  if (!check) return results;
  const result = await runCheck({ run, check });
  const isHealthFailure = check === SmokeCheck.Health && !result.passed;
  if (isHealthFailure) return [...results, result];
  return runInOrder({ run, checks: remaining, results: [...results, result] });
}

export function runSmokeChecks(input: SmokeRun): Promise<SmokeResult[]> {
  return runInOrder({ run: input, checks: smokeChecksFor(input), results: [] });
}

export function formatSmokeResult(input: { result: SmokeResult }): string {
  const { check, passed, status, detail } = input.result;
  const verdict = passed ? SmokeVerdict.Pass : SmokeVerdict.Fail;
  const line = `${verdict} ${String(status).padStart(STATUS_DIGITS, '0')} ${check}`;
  if (detail === null) return line;
  return `${line} (${detail})`;
}
