import { NEW_ACCOUNTS_PER_DAY_LIMIT } from '@zapbip/core';
import { AccountState, ChannelInboundKind, MessageKind } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiveOwnerInbound } from '../../src/inbound/owner-inbound';
import { applyDirectoryMigration, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';
import { bindingsWith, countAccounts, deliver, findAccounts, nextWamid, screenTextsOf, textEntry, WA_ID } from './owner-inbound-fixtures';

const OWNER_LIMIT = 20;
const SLEEPING_PHONE = '5511900000001';
const CONCURRENT_FIRST_MESSAGES = 2;
const EXPECTED_ACCOUNT_COUNT = 1;
const IMAGE_BYTES = 8;

async function blockPhone(input: { waId: string }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('INSERT INTO blocked_phones (wa_id, reason, created_at) VALUES (?, ?, ?)')
    .bind(input.waId, 'abuse', SEED_CREATED_AT)
    .run();
}

async function activeAccountId(input: { waId: string }): Promise<string> {
  const [account] = await findAccounts({ waId: input.waId });
  if (account === undefined) throw new Error('account is missing');
  return account.accountId;
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('owner inbound orchestrator', () => {
  it('drops a blocked phone without creating an account', async () => {
    await blockPhone({ waId: WA_ID });
    await deliver({ bindings: bindingsWith({ waitlistEnabled: false }), text: 'novo agente x' });
    expect(await findAccounts({ waId: WA_ID })).toEqual([]);
  });

  it('answers the first twenty messages of a minute and drops the twenty-first', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false, ownerLimit: OWNER_LIMIT });
    await Array.from({ length: OWNER_LIMIT }).reduce<Promise<unknown>>(
      (previous) => previous.then(() => deliver({ bindings, text: 'agentes' })),
      Promise.resolve(),
    );
    const accountId = await activeAccountId({ waId: WA_ID });
    const sentBefore = (await screenTextsOf({ accountId })).length;
    await deliver({ bindings, text: 'agentes' });
    expect((await screenTextsOf({ accountId })).length).toBe(sentBefore);
  });

  it('AK-4 logs the rate limit once and never calls the account inbox for the dropped message', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    const inboxCalls: string[] = [];
    const countingInbox = {
      idFromName: (name: string) => testEnv.ACCOUNT_INBOX.idFromName(name),
      get: (id: DurableObjectId) => {
        inboxCalls.push(id.toString());
        return testEnv.ACCOUNT_INBOX.get(id);
      },
    } as unknown as DurableObjectNamespace;
    const bindings = { ...bindingsWith({ waitlistEnabled: false, ownerLimit: 1 }), ACCOUNT_INBOX: countingInbox } as typeof testEnv;
    await deliver({ bindings, text: 'agentes' });
    const callsBefore = inboxCalls.length;
    await deliver({ bindings, text: 'agentes' });
    expect(inboxCalls).toHaveLength(callsBefore);
    expect(lines.filter((line) => line.includes('sender_rate_limited'))).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('drops a new phone silently once the daily cap of new accounts is reached', async () => {
    const statements = Array.from({ length: NEW_ACCOUNTS_PER_DAY_LIMIT }, (_, index) =>
      testEnv.CONNECTIONS.prepare('INSERT INTO accounts (id, state, created_at) VALUES (?, ?, ?)').bind(
        `acc_cap_${index}`,
        AccountState.Active,
        Date.now(),
      ),
    );
    await testEnv.CONNECTIONS.batch(statements);
    await deliver({ bindings: bindingsWith({ waitlistEnabled: false }), text: 'oi' });
    expect(await findAccounts({ waId: WA_ID })).toEqual([]);
    expect(await countAccounts()).toBe(NEW_ACCOUNTS_PER_DAY_LIMIT);
  });

  it('logs the daily cap alert once, without the phone', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    const statements = Array.from({ length: NEW_ACCOUNTS_PER_DAY_LIMIT }, (_, index) =>
      testEnv.CONNECTIONS.prepare('INSERT INTO accounts (id, state, created_at) VALUES (?, ?, ?)').bind(
        `acc_alert_${index}`,
        AccountState.Active,
        Date.now(),
      ),
    );
    await testEnv.CONNECTIONS.batch(statements);
    await deliver({ bindings: bindingsWith({ waitlistEnabled: false }), text: 'oi' });
    const alerts = lines.filter((line) => line.includes('account_daily_cap'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).not.toContain(WA_ID);
    vi.restoreAllMocks();
  });

  it('creates a waitlisted account on a first message while the waitlist is on', async () => {
    await deliver({ bindings: bindingsWith({ waitlistEnabled: true }), text: 'oi' });
    const [account] = await findAccounts({ waId: WA_ID });
    expect(account?.state).toBe(AccountState.Waitlisted);
    expect((await screenTextsOf({ accountId: await activeAccountId({ waId: WA_ID }) })).length).toBe(EXPECTED_ACCOUNT_COUNT);
  });

  it('creates an active account on a first message while the waitlist is off', async () => {
    await deliver({ bindings: bindingsWith({ waitlistEnabled: false }), text: 'oi' });
    const [account] = await findAccounts({ waId: WA_ID });
    expect(account?.state).toBe(AccountState.Active);
  });

  it('resolves two first messages from one phone to one account', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await Promise.all(Array.from({ length: CONCURRENT_FIRST_MESSAGES }, () => deliver({ bindings, text: 'oi' })));
    expect(await findAccounts({ waId: WA_ID })).toHaveLength(EXPECTED_ACCOUNT_COUNT);
  });

  it('creates one connection when the same delivery arrives twice', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    const channelMessageId = nextWamid();
    await deliver({ bindings, text: 'oi' });
    const first = await deliver({ bindings, text: 'novo agente alpha', channelMessageId });
    const second = await deliver({ bindings, text: 'novo agente alpha', channelMessageId });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const rows = await testEnv.CONNECTIONS.prepare('SELECT agent FROM connections').all<{ agent: string }>();
    expect(rows.results.map((row) => row.agent)).toEqual(['alpha']);
  });

  it('finishes the deletion of a deleting account without replying', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await deliver({ bindings, text: 'oi' });
    const accountId = await activeAccountId({ waId: WA_ID });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Deleting, accountId).run();
    await deliver({ bindings, text: 'oi' });
    expect(await findAccounts({ waId: WA_ID })).toEqual([]);
  });

  it('sends the confirmation before the account disappears', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await deliver({ bindings, text: 'oi' });
    const accountId = await activeAccountId({ waId: WA_ID });
    await deliver({ bindings, text: 'apagar conta' });
    await deliver({ bindings, text: 'apagar conta definitivamente' });
    expect(await findAccounts({ waId: WA_ID })).toEqual([]);
    const row = await testEnv.CONNECTIONS.prepare('SELECT id FROM accounts WHERE id = ?').bind(accountId).first();
    expect(row).toBeNull();
  });

  it('does not download media for a first message', async () => {
    const entryOf = vi.fn().mockResolvedValue(textEntry({ text: 'oi' }));
    await receiveOwnerInbound({ bindings: bindingsWith({ waitlistEnabled: false }), waId: WA_ID, channelMessageId: nextWamid(), entryOf });
    expect(entryOf).toHaveBeenCalledWith(expect.objectContaining({ downloadsMedia: false }));
  });

  it('downloads media for a later message of an active account', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await deliver({ bindings, text: 'oi' });
    const entryOf = vi.fn().mockResolvedValue({
      kind: ChannelInboundKind.Owner,
      at: Date.now(),
      content: {
        kind: MessageKind.Image,
        voice: false,
        mediaId: 'media_1',
        mimeType: 'image/png',
        sizeBytes: IMAGE_BYTES,
        filename: null,
        caption: null,
      },
      replyToChannelMessageId: null,
      forwarded: false,
      noticeText: null,
    });
    await receiveOwnerInbound({ bindings, waId: WA_ID, channelMessageId: nextWamid(), entryOf });
    expect(entryOf).toHaveBeenCalledWith(expect.objectContaining({ downloadsMedia: true }));
  });

  it('does not download media for a waitlisted account', async () => {
    await deliver({ bindings: bindingsWith({ waitlistEnabled: true }), text: 'oi' });
    const entryOf = vi.fn().mockResolvedValue(textEntry({ text: 'oi' }));
    await receiveOwnerInbound({ bindings: bindingsWith({ waitlistEnabled: true }), waId: WA_ID, channelMessageId: nextWamid(), entryOf });
    expect(entryOf).toHaveBeenCalledWith(expect.objectContaining({ downloadsMedia: false }));
  });

  it('rejects, and issues no secret, when the directory is unavailable', async () => {
    const failing = {
      prepare: () => {
        throw new Error('d1 is down');
      },
      batch: () => {
        throw new Error('d1 is down');
      },
    } as unknown as D1Database;
    const bindings = bindingsWith({ waitlistEnabled: false, connections: failing });
    await expect(deliver({ bindings, text: 'novo agente alpha', waId: SLEEPING_PHONE })).rejects.toThrow('d1 is down');
    expect(await findAccounts({ waId: SLEEPING_PHONE })).toEqual([]);
  });
});
