import { AccountState, ChannelInboundKind, MessageKind, OwnerLocale, ReplyStatus } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import { createSqliteDeletionRequests } from '../../src/account-inbox/deletion-requests';
import { createSqliteFirstMessageClaim } from '../../src/account-inbox/first-message-claim';
import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';
import { runMigrations } from '../../src/account-inbox/run-migrations';
import { D1ConnectionRegistry } from '../../src/adapters/d1/d1-connection-registry';
import { readScreen } from '../support/inbox-session';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, connectionOf, testEnv } from '../support/workers-env';

const ACCOUNT = 'acc_accounts';
const HELD_TIMEOUT_MS = 20_000;
const REQUESTED_AT = 1_800_000_000_000;
const SCHEMA_VERSION_SIX = 6;

type Internals = { dependencies: { waiters: { hasAgentWaiter(input: { agent: string }): boolean } } };

function stubOf() {
  return accountInboxStub({ accountId: ACCOUNT });
}

function inStorage<Result>(run: (storage: DurableObjectStorage) => Result | Promise<Result>): Promise<Result> {
  return runInDurableObject(stubOf(), (_instance, state) => run(state.storage));
}

function seedAgentWake(input: { agent: string }) {
  return stubOf().checkInbox({ connection: connectionOf({ accountId: ACCOUNT, agent: input.agent }) });
}

function hasLiveWaiter(input: { agent: string }): Promise<boolean> {
  return runInDurableObject(stubOf(), (instance: AccountInbox) =>
    (instance as unknown as Internals).dependencies.waiters.hasAgentWaiter(input),
  );
}

function listWakeAgents(): Promise<string[]> {
  return inStorage((storage) =>
    storage.sql
      .exec<{ agent: string }>('SELECT agent FROM agent_wake ORDER BY agent')
      .toArray()
      .map((row) => row.agent),
  );
}

function listRevokedAgents(): Promise<string[]> {
  return inStorage((storage) =>
    storage.sql
      .exec<{ agent: string }>('SELECT agent FROM revoked_agents ORDER BY agent')
      .toArray()
      .map((row) => row.agent),
  );
}

async function holdWait(input: { agent: string }) {
  const holding = stubOf().waitForReply({
    connection: connectionOf({ accountId: ACCOUNT, agent: input.agent }),
    questionId: null,
    timeoutMs: HELD_TIMEOUT_MS,
  });
  await vi.waitFor(async () => expect(await hasLiveWaiter(input)).toBe(true));
  return { holding };
}

afterEach(async () => {
  await reset();
});

describe('AccountInbox schema', () => {
  it('registers schema version six', async () => {
    const applied = await inStorage((storage) =>
      storage.sql
        .exec<{ version: number }>('SELECT version FROM schema_versions')
        .toArray()
        .map((row) => row.version),
    );
    expect(applied).toContain(SCHEMA_VERSION_SIX);
    expect(ACCOUNT_INBOX_MIGRATIONS.map((migration) => migration.version)).toContain(SCHEMA_VERSION_SIX);
    await inStorage((storage) => runMigrations({ storage, migrations: ACCOUNT_INBOX_MIGRATIONS }));
  });
});

describe('FirstMessageClaim', () => {
  it('claims the first message id and keeps it on a retry of the same delivery', async () => {
    const outcomes = await inStorage(async (storage) => {
      const claim = createSqliteFirstMessageClaim({ storage });
      return [
        await claim.claim({ channelMessageId: 'wamid.first' }),
        await claim.claim({ channelMessageId: 'wamid.first' }),
        await claim.claim({ channelMessageId: 'wamid.second' }),
      ];
    });
    expect(outcomes).toEqual([true, true, false]);
  });

  it('survives a restart', async () => {
    await inStorage((storage) => createSqliteFirstMessageClaim({ storage }).claim({ channelMessageId: 'wamid.first' }));
    const afterRestart = await inStorage((storage) =>
      createSqliteFirstMessageClaim({ storage }).claim({ channelMessageId: 'wamid.other' }),
    );
    expect(afterRestart).toBe(false);
  });

  it('keeps the first message id when a deletion request was saved first', async () => {
    const outcomes = await inStorage(async (storage) => {
      await createSqliteDeletionRequests({ storage }).save({ requestedAt: REQUESTED_AT });
      const claim = createSqliteFirstMessageClaim({ storage });
      return [await claim.claim({ channelMessageId: 'wamid.first' }), await claim.claim({ channelMessageId: 'wamid.second' })];
    });
    expect(outcomes).toEqual([true, false]);
  });
});

describe('DeletionRequests', () => {
  it('finds nothing before a request', async () => {
    expect(await inStorage((storage) => createSqliteDeletionRequests({ storage }).find())).toBeNull();
  });

  it('finds the saved time and replaces it on a second request', async () => {
    const found = await inStorage(async (storage) => {
      const requests = createSqliteDeletionRequests({ storage });
      await requests.save({ requestedAt: REQUESTED_AT });
      const first = await requests.find();
      await requests.save({ requestedAt: REQUESTED_AT + 1 });
      return [first, await requests.find()];
    });
    expect(found).toEqual([REQUESTED_AT, REQUESTED_AT + 1]);
  });

  it('clears the request and keeps the first message id', async () => {
    const outcome = await inStorage(async (storage) => {
      const requests = createSqliteDeletionRequests({ storage });
      await createSqliteFirstMessageClaim({ storage }).claim({ channelMessageId: 'wamid.first' });
      await requests.save({ requestedAt: REQUESTED_AT });
      await requests.clear();
      await requests.clear();
      return [await requests.find(), await createSqliteFirstMessageClaim({ storage }).claim({ channelMessageId: 'wamid.first' })];
    });
    expect(outcome).toEqual([null, true]);
  });

  it('keeps the request after the first message was claimed', async () => {
    const found = await inStorage(async (storage) => {
      await createSqliteFirstMessageClaim({ storage }).claim({ channelMessageId: 'wamid.first' });
      const requests = createSqliteDeletionRequests({ storage });
      await requests.save({ requestedAt: REQUESTED_AT });
      return requests.find();
    });
    expect(found).toBe(REQUESTED_AT);
  });
});

describe('AccountInbox revocation', () => {
  it('recordRevocation clears the wake state of that agent only and marks it revoked', async () => {
    await Promise.all([seedAgentWake({ agent: 'alpha' }), seedAgentWake({ agent: 'beta' })]);
    await stubOf().recordRevocation({ agent: 'alpha' });
    expect(await listWakeAgents()).toEqual(['beta']);
    expect(await listRevokedAgents()).toEqual(['alpha']);
  });

  it('recordRevocation is idempotent', async () => {
    await stubOf().recordRevocation({ agent: 'alpha' });
    await stubOf().recordRevocation({ agent: 'alpha' });
    expect(await listRevokedAgents()).toEqual(['alpha']);
  });

  it('recordRevocation ends a live wait_for_reply at once with a timeout', async () => {
    const { holding } = await holdWait({ agent: 'alpha' });
    const startedAt = Date.now();
    await stubOf().recordRevocation({ agent: 'alpha' });
    const outcome = await holding;
    expect(outcome).toEqual({ ok: true, value: { status: ReplyStatus.Timeout } });
    expect(Date.now() - startedAt).toBeLessThan(HELD_TIMEOUT_MS / 2);
  });

  it('recordRevocation leaves the wait of another agent alive', async () => {
    const { holding } = await holdWait({ agent: 'beta' });
    await stubOf().recordRevocation({ agent: 'alpha' });
    expect(await hasLiveWaiter({ agent: 'beta' })).toBe(true);
    await stubOf().cancelWaiters({ agent: 'beta' });
    await holding;
  });

  it('cancelWaiters ends a live wait at once and keeps the wake state and the revoked list', async () => {
    await seedAgentWake({ agent: 'alpha' });
    const { holding } = await holdWait({ agent: 'alpha' });
    await stubOf().cancelWaiters({ agent: 'alpha' });
    expect(await holding).toEqual({ ok: true, value: { status: ReplyStatus.Timeout } });
    expect(await listWakeAgents()).toEqual(['alpha']);
    expect(await listRevokedAgents()).toEqual([]);
  });
});

describe('AccountInbox receiveAccountMessage', () => {
  const OWNER_PHONE = '5511900000009';
  const PUBLIC_ORIGIN = 'https://zapbip.test';
  beforeEach(async () => {
    await seedOwnerIdentity({ accountId: ACCOUNT, phone: OWNER_PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
  });

  function receive(input: { text: string; channelMessageId: string }) {
    return stubOf().receiveAccountMessage({
      account: { accountId: ACCOUNT, waId: OWNER_PHONE, state: AccountState.Active, locale: OwnerLocale.PortugueseBrazil },
      channelMessageId: input.channelMessageId,
      entry: {
        kind: ChannelInboundKind.Owner,
        at: Date.now(),
        replyToChannelMessageId: null,
        content: { kind: MessageKind.Text, text: input.text },
        noticeText: null,
      },
      publicOrigin: PUBLIC_ORIGIN,
    });
  }

  function screenTexts(): Promise<string[]> {
    return readScreen({ stub: stubOf() }).then((entries) => entries.map((entry) => entry.text));
  }

  it('creates a connection and sends the install link without the secret', async () => {
    const outcome = await receive({ text: 'novo agente alpha', channelMessageId: 'wamid.create' });
    expect(outcome).toMatchObject({ ok: true, value: { duplicate: false, deletionConfirmed: false } });
    const connections = await new D1ConnectionRegistry({ database: testEnv.CONNECTIONS }).listActive({ accountId: ACCOUNT });
    expect(connections.map((connection) => connection.agent)).toEqual(['alpha']);
    const sent = (await screenTexts()).join('\n');
    expect(sent).toContain(`${PUBLIC_ORIGIN}/i/zb_inst_`);
    expect(sent).not.toContain('zb_conn_');
  });

  it('keeps no clear install code in the stored message log', async () => {
    await receive({ text: 'novo agente alpha', channelMessageId: 'wamid.mask' });
    expect((await screenTexts()).join('\n')).toMatch(/\/i\/zb_inst_[A-Za-z0-9_-]{22}/);
    const stored = await inStorage((storage) =>
      storage.sql
        .exec<{ payload: string }>('SELECT payload FROM inbox_messages')
        .toArray()
        .map((row) => row.payload)
        .join('\n'),
    );
    expect(stored).toContain('/i/zb_inst_');
    expect(stored).not.toMatch(/zb_inst_[A-Za-z0-9_-]{22}/);
  });

  it('answers a retried delivery as a duplicate without sending again', async () => {
    await receive({ text: 'novo agente alpha', channelMessageId: 'wamid.retry' });
    const sentBefore = (await screenTexts()).length;
    const retried = await receive({ text: 'novo agente alpha', channelMessageId: 'wamid.retry' });
    expect(retried).toMatchObject({ ok: true, value: { duplicate: true } });
    expect((await screenTexts()).length).toBe(sentBefore);
  });

  it('records the revocation on the object when an agent is revoked', async () => {
    await receive({ text: 'novo agente alpha', channelMessageId: 'wamid.one' });
    await receive({ text: 'revogar alpha', channelMessageId: 'wamid.two' });
    expect(await listRevokedAgents()).toEqual(['alpha']);
  });

  it('stores the deletion request and reports the confirmation', async () => {
    await receive({ text: 'apagar conta', channelMessageId: 'wamid.ask' });
    const requestedAt = await inStorage((storage) => createSqliteDeletionRequests({ storage }).find());
    expect(requestedAt).not.toBeNull();
    const confirmed = await receive({ text: 'apagar conta definitivamente', channelMessageId: 'wamid.confirm' });
    expect(confirmed).toMatchObject({ ok: true, value: { deletionConfirmed: true } });
  });

  it('refuses the message after a purge', async () => {
    await stubOf().purge();
    await expect(
      runInDurableObject(stubOf(), (instance: AccountInbox) =>
        instance.receiveAccountMessage({
          account: { accountId: ACCOUNT, waId: OWNER_PHONE, state: AccountState.Active, locale: OwnerLocale.PortugueseBrazil },
          channelMessageId: 'wamid.after',
          entry: {
            kind: ChannelInboundKind.Owner,
            at: Date.now(),
            replyToChannelMessageId: null,
            content: { kind: MessageKind.Text, text: 'oi' },
            noticeText: null,
          },
          publicOrigin: PUBLIC_ORIGIN,
        }),
      ),
    ).rejects.toThrow('AccountTombstoned');
  });
});

beforeEach(applyDirectoryMigration);
