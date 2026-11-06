import { AccountState, ForwardedKind, MessageKind, OwnerLocale } from '@zapbip/types';
import { evictDurableObject, reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import { createSqliteDeletionRequests } from '../../src/account-inbox/deletion-requests';
import { TOMBSTONE_STORAGE_KEY } from '../../src/account-inbox/constants';
import { openWindow } from '../support/inbox-session';
import { applyDirectoryMigration } from '../support/seed';
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

  it('ends every waiter that is still held', async () => {
    const connection = connectionOf({ accountId: ACCOUNT, agent: 'alpha' });
    const held = stubOf().waitForReply({ connection, questionId: null, timeoutMs: 20_000 });
    await stubOf().purge();
    const settled = await Promise.race([
      held.then(
        () => 'settled',
        () => 'settled',
      ),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 3_000)),
    ]);
    expect(settled).toBe('settled');
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
    const connection = connectionOf({ accountId: ACCOUNT, agent: 'alpha' });
    const writes: ((instance: AccountInbox) => Promise<unknown>)[] = [
      (instance) =>
        instance.receiveOwnerMessage({
          ownerLocale: OwnerLocale.PortugueseBrazil,
          channelMessageId: 'wamid.after',
          ownerMessage: {
            at: Date.now(),
            replyToMessageId: null,
            forwarded: ForwardedKind.None,
            content: { kind: MessageKind.Text, text: 'oi' },
          },
        }),
      (instance) => instance.recordRevocation({ agent: 'alpha' }),
      (instance) => instance.cancelWaiters({ agent: 'alpha' }),
      (instance) => instance.sendText({ connection, text: 'oi', replyToMessageId: null }),
    ];
    for (const write of writes) await expect(runInDurableObject(stubOf(), write)).rejects.toThrow(TOMBSTONED_MESSAGE);
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
  });

  it('keeps only the tombstone after a restart and a second purge', async () => {
    await purgeThenRestart({ restart: true });
    await stubOf().purge();
    expect(await listKeys()).toEqual([TOMBSTONE_STORAGE_KEY]);
  });
});

beforeEach(applyDirectoryMigration);
