import { SELF } from 'cloudflare:test';
import { ConnectorFrameType, UPGRADE_REQUIRED_STATUS } from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { createApp } from '../../src/app';
import { UNAUTHORIZED_BODY } from '../../src/contract/constants';
import { connectorUrl, openConnector } from '../support/connector-session';
import { testEnv } from '../support/workers-env';
import { seedAccount } from './route-fixtures';

const UNKNOWN_SECRET = `zb_conn_${'A'.repeat(43)}`;
const STATUS_SWITCHING_PROTOCOLS = 101;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const UPGRADE_HEADERS = { Upgrade: 'websocket' };
const IMPERSONATED_AGENT = 'bruno';

describe('connector route', () => {
  test('accepts the upgrade for a valid secret', async () => {
    const account = await seedAccount({ agent: 'ana' });
    const response = await SELF.fetch(connectorUrl({ secret: account.secret }), { headers: UPGRADE_HEADERS });
    expect(response.status).toBe(STATUS_SWITCHING_PROTOCOLS);
    expect(response.webSocket).not.toBeNull();
    response.webSocket?.accept();
    response.webSocket?.close();
  });

  test('answers 426 without the upgrade header', async () => {
    const account = await seedAccount({ agent: 'ana' });
    const response = await SELF.fetch(connectorUrl({ secret: account.secret }));
    expect(response.status).toBe(UPGRADE_REQUIRED_STATUS);
    expect(response.webSocket).toBeNull();
  });

  test('answers 401 with the MCP body for an unknown secret', async () => {
    const response = await SELF.fetch(connectorUrl({ secret: UNKNOWN_SECRET }), { headers: UPGRADE_HEADERS });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.json()).toEqual(UNAUTHORIZED_BODY);
  });

  test('answers 401 before 426 so a probe cannot confirm an unknown secret', async () => {
    const response = await SELF.fetch(connectorUrl({ secret: UNKNOWN_SECRET }));
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
  });

  test('answers 401 for a revoked secret', async () => {
    const account = await seedAccount({ agent: 'ana' });
    await testEnv.CONNECTIONS.prepare('DELETE FROM connections WHERE account_id = ?').bind(account.accountId).run();
    const response = await SELF.fetch(connectorUrl({ secret: account.secret }), { headers: UPGRADE_HEADERS });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
  });

  test('answers 404 for a method with no route', async () => {
    const account = await seedAccount({ agent: 'ana' });
    const response = await SELF.fetch(connectorUrl({ secret: account.secret }), { method: 'POST' });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('takes the agent from the secret and ignores the query', async () => {
    const account = await seedAccount({ agent: 'ana' });
    const session = await openConnector({ secret: account.secret, query: `?agent=${IMPERSONATED_AGENT}` });
    expect(await session.nextFrame()).toMatchObject({ type: ConnectorFrameType.Hello, agent: 'ana' });
    session.socket.close();
  });

  describe('without reaching the account object', () => {
    function countedEnvironment() {
      const objectCalls = vi.fn();
      const namespace = { idFromName: objectCalls, get: objectCalls };
      return { objectCalls, environment: { ...testEnv, ACCOUNT_INBOX: namespace as unknown as typeof testEnv.ACCOUNT_INBOX } };
    }

    test.each([
      ['an unknown secret', () => ({ path: `/c/${UNKNOWN_SECRET}/connector`, init: { headers: UPGRADE_HEADERS } })],
      ['a missing upgrade header', async () => ({ path: `/c/${(await seedAccount({ agent: 'ana' })).secret}/connector`, init: {} })],
      [
        'a method with no route',
        async () => ({ path: `/c/${(await seedAccount({ agent: 'ana' })).secret}/connector`, init: { method: 'POST' } }),
      ],
    ])('%s makes no call', async (_name, build) => {
      const { path, init } = await build();
      const { objectCalls, environment } = countedEnvironment();
      await createApp({ extraRoutes: [] }).request(path, init, environment);
      expect(objectCalls).not.toHaveBeenCalled();
    });
  });
});
