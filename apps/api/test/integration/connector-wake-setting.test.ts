import { WakeMode, WakeProvider, WakeStatus } from '@zapbip/types';
import type { StoredWake, WakeRepository } from '@zapbip/core';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test, vi } from 'vitest';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import { openConnector } from '../support/connector-session';
import { receiveOwnerText } from '../support/inbox-session';
import { expectOk } from '../support/wake-session';
import { accountInboxStub } from '../support/workers-env';
import { inboxOf, seedAccount, type SeededAccount } from './route-fixtures';

const AGENT = 'ana';
const GROK_URL = 'https://api2.cursor.sh/automations/webhook/abcdefgh12';
const GROK_TOKEN = 'p'.repeat(16);
const OTHER_TOKEN = 'q'.repeat(16);

type WakeHolder = { wake: { repository: WakeRepository } };

function withRepository<Result>(input: { account: SeededAccount; run: (repository: WakeRepository) => Promise<Result> }): Promise<Result> {
  const stub: DurableObjectStub<AccountInbox> = accountInboxStub({ accountId: input.account.accountId });
  return runInDurableObject(stub, (instance) => input.run((instance as unknown as WakeHolder).wake.repository));
}

function findWake(input: { account: SeededAccount }): Promise<StoredWake | null> {
  return withRepository({ account: input.account, run: (repository) => repository.findWake({ agent: AGENT }) });
}

function findRestore(input: { account: SeededAccount }): Promise<StoredWake | null> {
  return withRepository({ account: input.account, run: (repository) => repository.findLocalRestore({ agent: AGENT }) });
}

async function registeredAccount(): Promise<SeededAccount> {
  const account = await seedAccount({ agent: AGENT });
  expectOk(await inboxOf({ accountId: account.accountId }).checkInbox({ connection: account.connection }));
  return account;
}

async function enableWebhook(input: { account: SeededAccount; token?: string }): Promise<StoredWake> {
  const { account } = input;
  const token = input.token === undefined ? GROK_TOKEN : input.token;
  expectOk(
    await inboxOf({ accountId: account.accountId }).setWake({
      connection: account.connection,
      setting: { mode: WakeMode.Webhook, url: GROK_URL, token },
    }),
  );
  const stored = await findWake({ account });
  if (stored === null) throw new Error('the webhook wake was not stored');
  return stored;
}

async function attached(input: { account: SeededAccount }) {
  const session = await openConnector({ secret: input.account.secret });
  await session.nextFrame();
  return session;
}

describe('restore record', () => {
  test('saves, reads and deletes the previous record', async () => {
    const account = await registeredAccount();
    const previous: StoredWake = {
      agent: AGENT,
      mode: WakeMode.Webhook,
      target: { provider: WakeProvider.GrokRoutine, host: 'api2.cursor.sh', sealedTarget: 'sealed', keyVersion: 1 },
      status: WakeStatus.Failing,
      lastDeliveredAt: 5,
    };
    await withRepository({ account, run: (repository) => repository.saveLocalRestore({ agent: AGENT, previous }) });
    expect(await findRestore({ account })).toEqual(previous);
    await withRepository({ account, run: (repository) => repository.deleteLocalRestore({ agent: AGENT }) });
    expect(await findRestore({ account })).toBeNull();
  });

  test('is separate from the wake columns', async () => {
    const account = await registeredAccount();
    const previous = await findWake({ account });
    if (previous === null) throw new Error('no wake row');
    await withRepository({ account, run: (repository) => repository.saveLocalRestore({ agent: AGENT, previous }) });
    await withRepository({ account, run: (repository) => repository.saveWake({ wake: { ...previous, mode: WakeMode.Local } }) });
    expect(await findRestore({ account })).toEqual(previous);
  });

  test('saving the same mode twice keeps one value', async () => {
    const account = await registeredAccount();
    const previous = await findWake({ account });
    if (previous === null) throw new Error('no wake row');
    const local: StoredWake = { ...previous, mode: WakeMode.Local };
    await withRepository({
      account,
      run: async (repository) => {
        await repository.saveWake({ wake: local });
        await repository.saveWake({ wake: local });
      },
    });
    expect(await findWake({ account })).toEqual(local);
  });

  test('refuses to save a restore for an agent with no wake row', async () => {
    const account = await seedAccount({ agent: AGENT });
    const previous: StoredWake = { agent: AGENT, mode: WakeMode.None, target: null, status: WakeStatus.Active, lastDeliveredAt: null };
    await expect(withRepository({ account, run: (repository) => repository.saveLocalRestore({ agent: AGENT, previous }) })).rejects.toThrow(
      'no agent_wake row',
    );
  });
});

describe('wake setting while a connector is attached', () => {
  test('attaching saves the local mode', async () => {
    const account = await registeredAccount();
    const session = await attached({ account });
    expect((await findWake({ account }))?.mode).toBe(WakeMode.Local);
    session.socket.close();
  });

  test('attaching registers an agent that never called a tool', async () => {
    const account = await seedAccount({ agent: AGENT });
    const session = await attached({ account });
    expect((await findWake({ account }))?.mode).toBe(WakeMode.Local);
    session.socket.close();
  });

  test('closing the last socket restores the previous setting', async () => {
    const account = await registeredAccount();
    const previous = await enableWebhook({ account });
    const session = await attached({ account });
    session.socket.close();
    await vi.waitFor(async () => expect(await findWake({ account })).toEqual(previous));
    expect(await findRestore({ account })).toBeNull();
  });

  test('closing one of two sockets keeps the local setting', async () => {
    const account = await registeredAccount();
    const previous = await enableWebhook({ account });
    const first = await attached({ account });
    const second = await attached({ account });
    await first.closeCode();
    expect((await findWake({ account }))?.mode).toBe(WakeMode.Local);
    expect(await findRestore({ account })).toEqual(previous);
    second.socket.close();
  });

  test('a second attach keeps the true previous setting', async () => {
    const account = await registeredAccount();
    const previous = await enableWebhook({ account });
    const first = await attached({ account });
    const second = await attached({ account });
    await first.closeCode();
    second.socket.close();
    await vi.waitFor(async () => expect(await findWake({ account })).toEqual(previous));
  });

  test('a change the user made while attached is kept', async () => {
    const account = await registeredAccount();
    const session = await attached({ account });
    const changed = await enableWebhook({ account });
    session.socket.close();
    await vi.waitFor(async () => expect(await findRestore({ account })).toBeNull());
    expect(await findWake({ account })).toEqual(changed);
  });

  test('a socket error restores the previous setting like a close', async () => {
    const account = await registeredAccount();
    const previous = await enableWebhook({ account });
    const session = await attached({ account });
    await runInDurableObject(accountInboxStub({ accountId: account.accountId }), async (instance, state) => {
      const [serverSocket] = state.getWebSockets(AGENT);
      if (serverSocket === undefined) throw new Error('no server socket');
      await (instance as AccountInbox).webSocketError(serverSocket);
    });
    expect(await findWake({ account })).toEqual(previous);
    expect(await findRestore({ account })).toBeNull();
    session.socket.close();
  });

  test('a half-open replacement keeps the setting the user chose in between', async () => {
    const account = await registeredAccount();
    await enableWebhook({ account });
    const first = await attached({ account });
    const newer = await enableWebhook({ account, token: OTHER_TOKEN });
    const second = await attached({ account });
    await first.closeCode();
    second.socket.close();
    await vi.waitFor(async () => expect(await findWake({ account })).toEqual(newer));
  });

  test('an owner message with no live socket restores the previous setting and wakes through it', async () => {
    const account = await registeredAccount();
    const previous = await enableWebhook({ account });
    const session = await attached({ account });
    await expect(
      runInDurableObject(accountInboxStub({ accountId: account.accountId }), (_instance, state) => state.abort('evicted')),
    ).rejects.toThrow('evicted');
    await session.closeCode();
    const stub = accountInboxStub({ accountId: account.accountId });
    await receiveOwnerText({ stub, text: `@${AGENT} oi` });
    expect(await findWake({ account })).toEqual(previous);
    expect(await findRestore({ account })).toBeNull();
    const jobs = await runInDurableObject(stub, (_instance, state) => state.storage.sql.exec('SELECT agent FROM wake_jobs').toArray());
    expect(jobs).toHaveLength(1);
  });
});
