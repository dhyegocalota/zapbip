import { CONNECTOR_PATH_SUFFIX, ConnectorFrameType, REVOKED_CLOSE_CODE } from '@zapbip/types';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { CONNECTOR_AGENT_PARAMETER, CONNECTOR_DIGEST_PARAMETER, CONNECTOR_OBJECT_ORIGIN } from '../../src/account-inbox/constants';
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
