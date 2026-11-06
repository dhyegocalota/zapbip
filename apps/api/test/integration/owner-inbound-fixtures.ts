import type { ChannelInboundEntry } from '@zapbip/core';
import { ChannelInboundKind, ForwardedKind, InstallCodeStatus, MessageKind, type AccountState } from '@zapbip/types';
import type { Bindings } from '../../src/contract/env';
import { receiveOwnerInbound } from '../../src/inbound/owner-inbound';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { readScreen } from '../support/inbox-session';
import { installCodeDirectory } from '../support/install-codes';
import { accountInboxStub, testEnv } from '../support/workers-env';

export const WA_ID = '5511900000000';

const INSTALL_CODE_PATTERN = /zb_inst_[A-Za-z0-9_-]{22}/g;

type AccountRow = { accountId: string; state: AccountState };

let deliveryCounter = 0;

export function nextWamid(): string {
  deliveryCounter += 1;
  return `wamid.inbound.${deliveryCounter}`;
}

export function textEntry(input: { text: string }): ChannelInboundEntry {
  return {
    kind: ChannelInboundKind.Owner,
    at: Date.now(),
    content: { kind: MessageKind.Text, text: input.text },
    replyToChannelMessageId: null,
    forwarded: ForwardedKind.None,
    noticeText: null,
  };
}

export function bindingsWith(input: { waitlistEnabled: boolean; ownerLimit?: number; connections?: D1Database }): Bindings {
  return {
    ...testEnv,
    WAITLIST_ENABLED: String(input.waitlistEnabled),
    OWNER_RATE_LIMITER: createFakeRateLimiter({ limit: input.ownerLimit === undefined ? Number.MAX_SAFE_INTEGER : input.ownerLimit }),
    CONNECTIONS: input.connections === undefined ? testEnv.CONNECTIONS : input.connections,
  };
}

export function deliver(input: { bindings: Bindings; text: string; waId?: string; channelMessageId?: string }) {
  const entry = textEntry({ text: input.text });
  return receiveOwnerInbound({
    bindings: input.bindings,
    waId: input.waId === undefined ? WA_ID : input.waId,
    channelMessageId: input.channelMessageId === undefined ? nextWamid() : input.channelMessageId,
    entryOf: async () => entry,
  });
}

export async function findAccounts(input: { waId: string }): Promise<AccountRow[]> {
  const result = await testEnv.CONNECTIONS.prepare(
    'SELECT accounts.id AS accountId, accounts.state AS state FROM accounts JOIN owner_identities ON owner_identities.account_id = accounts.id WHERE owner_identities.wa_id = ?',
  )
    .bind(input.waId)
    .all<AccountRow>();
  return result.results;
}

export async function countAccounts(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM accounts').first<{ total: number }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

export async function screenTextsOf(input: { accountId: string }): Promise<string[]> {
  const entries = await readScreen({ stub: accountInboxStub({ accountId: input.accountId }) });
  return entries.map((entry) => entry.text);
}

export async function latestMcpPath(input: { accountId: string }): Promise<string> {
  const texts = await screenTextsOf({ accountId: input.accountId });
  const installCode = texts.join('\n').match(INSTALL_CODE_PATTERN)?.at(-1);
  if (installCode === undefined) throw new Error('no install code on the screen');
  const resolution = await installCodeDirectory().resolve({ installCode, now: Date.now() });
  if (resolution.status !== InstallCodeStatus.Ready) throw new Error('the install code is not ready');
  return new URL(resolution.connectionLink).pathname;
}
