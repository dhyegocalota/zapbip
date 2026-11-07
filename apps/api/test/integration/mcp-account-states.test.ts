import { reset } from 'cloudflare:test';
import { AccountState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UNAUTHORIZED_BODY } from '../../src/contract/constants';
import { applyDirectoryMigration } from '../support/seed';
import { testEnv } from '../support/workers-env';
import { postMcp, seedConnectionWithSecret, type SeededConnection } from './mcp-fixtures';

const UNAUTHORIZED_TEXT = JSON.stringify(UNAUTHORIZED_BODY);
const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;

async function setState(input: { accountId: string; state: AccountState }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(input.state, input.accountId).run();
}

describe('MCP account states', () => {
  let connection: SeededConnection;

  beforeEach(async () => {
    await applyDirectoryMigration();
    connection = await seedConnectionWithSecret({ accountId: 'acc_states', agent: 'alpha' });
  });

  afterEach(reset);

  it.each([AccountState.Suspended, AccountState.Deleting, AccountState.Waitlisted])(
    'answers 401 while the account is %s',
    async (state) => {
      await setState({ accountId: connection.accountId, state });
      const response = await postMcp({ path: `/c/${connection.secret}/mcp` });
      expect(response.status).toBe(STATUS_UNAUTHORIZED);
      expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
    },
  );

  it('answers 200 again as soon as the operator sets the account back to active', async () => {
    await setState({ accountId: connection.accountId, state: AccountState.Suspended });
    await postMcp({ path: `/c/${connection.secret}/mcp` });
    await setState({ accountId: connection.accountId, state: AccountState.Active });
    expect((await postMcp({ path: `/c/${connection.secret}/mcp` })).status).toBe(STATUS_OK);
  });

  it('answers a revoked connection with the bytes of an unknown secret', async () => {
    await testEnv.CONNECTIONS.prepare('UPDATE connections SET revoked_at = ? WHERE secret_digest = ?')
      .bind(1, connection.secretDigest)
      .run();
    const response = await postMcp({ path: `/c/${connection.secret}/mcp` });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });
});
