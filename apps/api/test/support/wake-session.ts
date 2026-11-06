import type { AgentName, RecordedWakeRequest, ScriptedWakeResponse, SetWakeResult, WakeDependencies } from '@zapbip/core';
import { WAKE_COPY } from '@zapbip/core';
import { ForwardedKind, MessageKind, OwnerLocale, WakeCopyKey, WakeMode } from '@zapbip/types';
import { runInDurableObject } from 'cloudflare:test';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import type { CallOutcome } from '../../src/contract/account-inbox-rpc';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { advanceClock, readScreen } from './inbox-session';
import { accountInboxStub, connectionOf } from './workers-env';

export const WAKE_ACCOUNT = 'acc_wake';
export const WAKE_AGENT = 'alpha';
export const GROK_URL = 'https://api2.cursor.sh/automations/webhook/abc12345';
export const GROK_TOKEN = 'grok-token-sixteen-chars';
export const DEBOUNCE_ADVANCE_MS = 3_000;
export const ACCEPTED: ScriptedWakeResponse = { statusCode: 200, errorName: null, retryAfterMs: null };
export const UNAVAILABLE: ScriptedWakeResponse = { statusCode: 503, errorName: null, retryAfterMs: null };
export const UNAUTHORIZED: ScriptedWakeResponse = { statusCode: 401, errorName: null, retryAfterMs: null };

export type WakeRow = {
  agent: string;
  mode: string;
  provider: string | null;
  host: string | null;
  sealed_target: string | null;
  key_version: number | null;
  status: string;
  last_polled_at: number;
  last_delivered_at: number | null;
  updated_at: number;
};

export type WakeJobRow = {
  agent: string;
  due_at: number;
  attempt: number;
  lease_until: number | null;
  rewake: number;
  last_outcome: string | null;
};

export function wakeStub(input: { accountId?: string }): DurableObjectStub<DevAccountInbox> {
  const accountId = input.accountId === undefined ? WAKE_ACCOUNT : input.accountId;
  return accountInboxStub({ accountId }) as unknown as DurableObjectStub<DevAccountInbox>;
}

export function expectOk<Value>(outcome: CallOutcome<Value>): Value {
  if (!outcome.ok) throw new Error(`expected ok, received ${outcome.errorCode}: ${outcome.message}`);
  return outcome.value;
}

export async function enableGrokWake(input: {
  stub: DurableObjectStub<AccountInbox>;
  agent?: AgentName;
  token?: string;
}): Promise<SetWakeResult> {
  const agent = input.agent === undefined ? WAKE_AGENT : input.agent;
  const token = input.token === undefined ? GROK_TOKEN : input.token;
  return expectOk(
    await input.stub.setWake({
      connection: connectionOf({ accountId: WAKE_ACCOUNT, agent }),
      setting: { mode: WakeMode.Webhook, url: GROK_URL, token, intervalMinutes: null, standbyAgent: null },
    }),
  );
}

export function mentionText(input: { text: string }): string {
  return `@${WAKE_AGENT} ${input.text}`;
}

export function receiveEnglishText(input: { stub: DurableObjectStub<AccountInbox>; text: string; channelMessageId: string }) {
  return input.stub.receiveOwnerMessage({
    ownerLocale: OwnerLocale.EnglishUs,
    channelMessageId: input.channelMessageId,
    ownerMessage: {
      at: Date.now(),
      replyToMessageId: null,
      forwarded: ForwardedKind.None,
      content: { kind: MessageKind.Text, text: mentionText({ text: input.text }) },
    },
  });
}

export function readRequests(input: { stub: DurableObjectStub<DevAccountInbox>; agent?: AgentName }): Promise<RecordedWakeRequest[]> {
  return input.stub.devReadWakeRequests({ agent: input.agent === undefined ? WAKE_AGENT : input.agent });
}

export function readWakeRow(input: { stub: DurableObjectStub<AccountInbox>; agent?: AgentName }): Promise<WakeRow> {
  const agent = input.agent === undefined ? WAKE_AGENT : input.agent;
  return runInDurableObject(input.stub, (_instance, state) =>
    state.storage.sql.exec<WakeRow>('SELECT * FROM agent_wake WHERE agent = ?', agent).one(),
  );
}

export function readWakeJobs(input: { stub: DurableObjectStub<AccountInbox> }): Promise<WakeJobRow[]> {
  return runInDurableObject(input.stub, (_instance, state) => state.storage.sql.exec<WakeJobRow>('SELECT * FROM wake_jobs').toArray());
}

export async function readWakeNotices(input: { stub: DurableObjectStub<AccountInbox>; locale?: OwnerLocale }): Promise<number> {
  const locale = input.locale === undefined ? OwnerLocale.PortugueseBrazil : input.locale;
  const entries = await readScreen({ stub: input.stub });
  return entries.filter((entry) => entry.text === WAKE_COPY[WakeCopyKey.WakeFailed][locale].replace('{agent}', WAKE_AGENT)).length;
}

export function replaceWakeDependencies(input: { stub: DurableObjectStub<AccountInbox>; patch: Partial<WakeDependencies> }): Promise<void> {
  return runInDurableObject(input.stub, (instance) => {
    Object.assign((instance as unknown as { wake: WakeDependencies }).wake, input.patch);
  });
}

export function readLastRequestedAt(input: { stub: DurableObjectStub<AccountInbox>; agent?: AgentName }): Promise<number> {
  const agent = input.agent === undefined ? WAKE_AGENT : input.agent;
  return runInDurableObject(input.stub, async (instance) => {
    const lastRequestedAt = await (instance as unknown as { wake: WakeDependencies }).wake.repository.findLastRequestedAt({ agent });
    if (lastRequestedAt === null) throw new Error('no wake was requested');
    return lastRequestedAt;
  });
}
