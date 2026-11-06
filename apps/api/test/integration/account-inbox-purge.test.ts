import { AccountState } from '@zapbip/types';
import { evictDurableObject, reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSqliteDeletionRequests } from '../../src/account-inbox/deletion-requests';
import { TOMBSTONE_STORAGE_KEY } from '../../src/account-inbox/constants';
import { openWindow, receiveOwnerText } from '../support/inbox-session';
import { accountInboxStub, connectionOf } from '../support/workers-env';

const ACCOUNT = 'acc_purge';
const TOMBSTONED_MESSAGE = 'AccountTombstoned';

function stubOf() {
  return accountInboxStub({ accountId: ACCOUNT });
}

function readStorage<Result>(read: (storage: DurableObjectStorage) => Promise<Result> | Result): Promise<Result> {
  return runInDurableObject(stubOf(), (_instance, state) => read(state.storage));
}

async function populate() {
  const stub = stubOf();
  const connection = connectionOf({ accountId: ACCOUNT, agent: 'alpha' });
  await openWindow({ stub });
  await stub.sendText({ connection, text: 'oi', replyToMessageId: null });
  await stub.ask({ connection, text: 'Deploy?', options: ['Sim', 'Nao'], optionDescriptions: [null, null], timeoutMs: 10 });
  await readStorage((storage) => createSqliteDeletionRequests({ storage }).save({ requestedAt: Date.now() }));
}

function listKeys() {
  return readStorage(async (storage) => [...(await storage.list()).keys()]);
}

afterEach(async () => {
  await reset();
});

describe('AccountInbox purge', () => {
  it('leaves only the tombstone and no alarm', async () => {
    await populate();
    await stubOf().purge();
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
    expect(await readStorage((storage) => storage.getAlarm())).toBeNull();
    const tableCount = await readStorage(
      (storage) =>
        storage.sql.exec<{ total: number }>("SELECT COUNT(*) AS total FROM sqlite_master WHERE name = 'inbox_messages'").one().total,
    );
    expect(tableCount).toBe(0);
  });

  it('is idempotent', async () => {
    await populate();
    await stubOf().purge();
    await expect(stubOf().purge()).resolves.toBeUndefined();
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
  });

  it('purges an inbox that never held data', async () => {
    await expect(stubOf().purge()).resolves.toBeUndefined();
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
  });

  it('runs an alarm on the purged instance without writing', async () => {
    await populate();
    await stubOf().purge();
    await runDurableObjectAlarm(stubOf());
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
    expect(await readStorage((storage) => storage.getAlarm())).toBeNull();
  });
});

describe('AccountInbox after purge', () => {
  async function purgeThenRestart(input: { restart: boolean }) {
    await populate();
    await stubOf().purge();
    if (input.restart) await evictDurableObject(stubOf());
  }

  it.each([false, true])('refuses every write (restart %s)', async (restart) => {
    await purgeThenRestart({ restart });
    const refusals = [
      receiveOwnerText({ stub: stubOf(), text: 'oi' }),
      stubOf().recordRevocation({ agent: 'alpha' }),
      stubOf().cancelWaiters({ agent: 'alpha' }),
      stubOf().setState({ state: AccountState.Active }),
      stubOf().sendText({ connection: connectionOf({ accountId: ACCOUNT, agent: 'alpha' }), text: 'oi', replyToMessageId: null }),
    ];
    await Promise.all(refusals.map((refusal) => expect(refusal).rejects.toThrow(TOMBSTONED_MESSAGE)));
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
  });

  it('keeps only the tombstone after a restart and a second purge', async () => {
    await purgeThenRestart({ restart: true });
    await stubOf().purge();
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
  });
});
