import { CONNECTOR_PATH_SUFFIX, ConnectorFrameType, REVOKED_CLOSE_CODE } from '@zapbip/types';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import {
  CONNECTOR_AGENT_PARAMETER,
  CONNECTOR_DIGEST_PARAMETER,
  CONNECTOR_OBJECT_ORIGIN,
  TOMBSTONE_STORAGE_KEY,
} from '../../src/account-inbox/constants';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { openConnector, type ConnectorSession } from '../support/connector-session';
import { seedConnection, SEED_CREATED_AT } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { seedAccount } from './route-fixtures';

const AGENT = 'ana';
const OTHER_SECRET = `zb_conn_${'B'.repeat(43)}`;
const UPGRADE_HEADERS = { Upgrade: 'websocket' };

async function connectPastTheRoute(input: { accountId: string; secretDigest: string }): Promise<ConnectorSession> {
  const url = new URL(`${CONNECTOR_OBJECT_ORIGIN}${CONNECTOR_PATH_SUFFIX}`);
  url.searchParams.set(CONNECTOR_AGENT_PARAMETER, AGENT);
  url.searchParams.set(CONNECTOR_DIGEST_PARAMETER, input.secretDigest);
  const response = await accountInboxStub({ accountId: input.accountId }).fetch(url, { headers: UPGRADE_HEADERS });
  const { webSocket: socket } = response;
  if (socket === null) throw new Error(`object upgrade answered ${response.status}`);
  const received: unknown[] = [];
  const closed = new Promise<number>((resolve) => socket.addEventListener('close', (event) => resolve(event.code)));
  socket.addEventListener('message', (event) => received.push(JSON.parse(String(event.data))));
  socket.accept();
  return {
    socket,
    nextFrame: () => Promise.reject(new Error('not used')),
    receivedCount: () => received.length,
    closeCode: () => closed,
  };
}

function rowCountOf(input: { accountId: string; table: string }): Promise<number> {
  return runInDurableObject(
    accountInboxStub({ accountId: input.accountId }),
    (_instance, state) => state.storage.sql.exec<{ total: number }>(`SELECT COUNT(*) AS total FROM ${input.table}`).one().total,
  );
}

async function touchedNothing(input: { accountId: string }): Promise<void> {
  expect(await rowCountOf({ ...input, table: 'agents' })).toBe(0);
  expect(await rowCountOf({ ...input, table: 'agent_wake' })).toBe(0);
}

type DeferredKeyCheck = { isConnectorKeyLive: () => Promise<boolean> };

function deferredGate(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolveGate) => {
    resolve = resolveGate;
  });
  return { promise, resolve };
}

function connectionRequestOf(input: { secretDigest: string }): Request {
  const url = new URL(`${CONNECTOR_OBJECT_ORIGIN}${CONNECTOR_PATH_SUFFIX}`);
  url.searchParams.set(CONNECTOR_AGENT_PARAMETER, AGENT);
  url.searchParams.set(CONNECTOR_DIGEST_PARAMETER, input.secretDigest);
  return new Request(url, { headers: UPGRADE_HEADERS });
}

async function connectWhileKeyCheckIsPending(input: {
  accountId: string;
  secretDigest: string;
  meanwhile: (instance: AccountInbox) => Promise<void>;
  settle: (input: { outcome: Promise<Response> }) => Promise<void>;
}): Promise<void> {
  await runInDurableObject(accountInboxStub({ accountId: input.accountId }), async (instance: AccountInbox) => {
    const gate = deferredGate();
    const deferred: DeferredKeyCheck = { isConnectorKeyLive: () => gate.promise.then(() => true) };
    Object.assign(instance, deferred);
    const outcome = instance.fetch(connectionRequestOf({ secretDigest: input.secretDigest }));
    await input.meanwhile(instance);
    gate.resolve();
    await input.settle({ outcome });
  });
}

function socketCountOf(input: { accountId: string }): Promise<number> {
  return runInDurableObject(accountInboxStub({ accountId: input.accountId }), (_instance, state) => state.getWebSockets(AGENT).length);
}

describe('connector connect racing a rotation or a purge during the directory read', () => {
  test('a connect with the old key whose directory read is answered after a rotate is refused and touches nothing', async () => {
    const account = await seedAccount({ agent: AGENT });
    const oldDigest = await hashConnectionSecret({ secret: account.secret });
    const newDigest = await hashConnectionSecret({ secret: OTHER_SECRET });
    await connectWhileKeyCheckIsPending({
      accountId: account.accountId,
      secretDigest: oldDigest,
      meanwhile: (instance) => instance.recordRotation({ agent: AGENT, secretDigest: newDigest }),
      settle: async ({ outcome }) => {
        await outcome;
      },
    });
    expect(await socketCountOf({ accountId: account.accountId })).toBe(0);
    await touchedNothing({ accountId: account.accountId });
  });

  test('pin: the new key still connects after a rotate', async () => {
    const account = await seedAccount({ agent: AGENT });
    const newDigest = await hashConnectionSecret({ secret: OTHER_SECRET });
    await accountInboxStub({ accountId: account.accountId }).recordRotation({ agent: AGENT, secretDigest: newDigest });
    await connectWhileKeyCheckIsPending({
      accountId: account.accountId,
      secretDigest: newDigest,
      meanwhile: async () => undefined,
      settle: async ({ outcome }) => {
        await outcome;
      },
    });
    expect(await socketCountOf({ accountId: account.accountId })).toBe(1);
  });

  test('a revoked agent keeps no key digest in the object', async () => {
    const account = await seedAccount({ agent: AGENT });
    await accountInboxStub({ accountId: account.accountId }).recordRevocation({ agent: AGENT });
    const keys = await runInDurableObject(accountInboxStub({ accountId: account.accountId }), (_instance, state) => [
      ...state.storage.kv.list(),
    ]);
    expect(keys.map(([key]) => key).filter((key) => key.includes(AGENT))).toEqual([]);
  });

  test('a purge during the directory read refuses the connect as a tombstoned account and touches nothing', async () => {
    const account = await seedAccount({ agent: AGENT });
    const secretDigest = await hashConnectionSecret({ secret: account.secret });
    await connectWhileKeyCheckIsPending({
      accountId: account.accountId,
      secretDigest,
      meanwhile: (instance) => instance.purge(),
      settle: async ({ outcome }) => {
        await expect(outcome).rejects.toThrow('AccountTombstoned');
      },
    });
    expect(await socketCountOf({ accountId: account.accountId })).toBe(0);
    const keys = await runInDurableObject(accountInboxStub({ accountId: account.accountId }), async (_instance, state) => [
      ...(await state.storage.list()).keys(),
    ]);
    expect(keys).toEqual([TOMBSTONE_STORAGE_KEY]);
  });
});

describe('connector connect racing a revocation', () => {
  test('a key revoked between the route check and the object accept is closed and touches nothing', async () => {
    const account = await seedAccount({ agent: AGENT });
    const secretDigest = await hashConnectionSecret({ secret: account.secret });
    await testEnv.CONNECTIONS.prepare('UPDATE connections SET revoked_at = ? WHERE account_id = ?')
      .bind(SEED_CREATED_AT, account.accountId)
      .run();
    const session = await connectPastTheRoute({ accountId: account.accountId, secretDigest });
    await touchedNothing({ accountId: account.accountId });
    expect(await session.closeCode()).toBe(REVOKED_CLOSE_CODE);
    expect(session.receivedCount()).toBe(0);
  });

  test('a key rotated between the route check and the object accept is closed and touches nothing', async () => {
    const account = await seedAccount({ agent: AGENT });
    const rotatedDigest = await hashConnectionSecret({ secret: account.secret });
    await testEnv.CONNECTIONS.prepare('UPDATE connections SET revoked_at = ? WHERE account_id = ?')
      .bind(SEED_CREATED_AT, account.accountId)
      .run();
    await seedConnection({ accountId: account.accountId, agent: AGENT, secret: OTHER_SECRET });
    const session = await connectPastTheRoute({ accountId: account.accountId, secretDigest: rotatedDigest });
    await touchedNothing({ accountId: account.accountId });
    expect(await session.closeCode()).toBe(REVOKED_CLOSE_CODE);
    expect(session.receivedCount()).toBe(0);
  });

  test('an agent already on the revoked list inside the object is closed and touches nothing', async () => {
    const account = await seedAccount({ agent: AGENT });
    const secretDigest = await hashConnectionSecret({ secret: account.secret });
    await accountInboxStub({ accountId: account.accountId }).recordRevocation({ agent: AGENT });
    const session = await connectPastTheRoute({ accountId: account.accountId, secretDigest });
    await touchedNothing({ accountId: account.accountId });
    expect(await session.closeCode()).toBe(REVOKED_CLOSE_CODE);
  });

  test('pin: a live key still connects and receives hello', async () => {
    const account = await seedAccount({ agent: AGENT });
    const session = await openConnector({ secret: account.secret });
    expect(await session.nextFrame()).toMatchObject({ type: ConnectorFrameType.Hello, agent: AGENT });
    session.socket.close();
  });
});
