import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { CONNECTION_SECRET_PREFIX, UNAUTHORIZED_BODY } from '../../src/contract/constants';
import { applyCoreSchema, postMcp, seedConnection, type SeededConnection } from './mcp-fixtures';

const UNKNOWN_SECRET = `${CONNECTION_SECRET_PREFIX}${'A'.repeat(43)}`;
const MALFORMED_SECRET = `${CONNECTION_SECRET_PREFIX}short`;
const UNAUTHORIZED_TEXT = JSON.stringify(UNAUTHORIZED_BODY);

describe('MCP secret and Bearer resolution', () => {
  let connection: SeededConnection;

  beforeEach(async () => {
    await applyCoreSchema();
    connection = await seedConnection({ accountId: 'acc_1', agent: 'alpha' });
  });

  it('rejects an unknown secret on the path', async () => {
    const response = await postMcp({ path: `/c/${UNKNOWN_SECRET}/mcp` });
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });

  it('answers a deleted connection with the same bytes as an unknown secret', async () => {
    await env.CONNECTIONS.prepare('DELETE FROM connections WHERE secret_digest = ?').bind(connection.secretDigest).run();
    const response = await postMcp({ path: `/c/${connection.secret}/mcp` });
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });

  it('rejects a malformed secret without querying the directory', async () => {
    await env.CONNECTIONS.prepare('DROP TABLE connections').run();
    const response = await postMcp({ path: `/c/${MALFORMED_SECRET}/mcp` });
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });

  it('accepts a valid Bearer on /mcp', async () => {
    const response = await postMcp({ path: '/mcp', bearer: connection.secret });
    expect(response.status).toBe(200);
  });

  it('rejects /mcp without an Authorization header', async () => {
    const response = await postMcp({ path: '/mcp' });
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });

  it('rejects /mcp with an unknown Bearer', async () => {
    const response = await postMcp({ path: '/mcp', bearer: UNKNOWN_SECRET });
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });

  it('prefers the path secret over a wrong Bearer', async () => {
    const response = await postMcp({ path: `/c/${connection.secret}/mcp`, bearer: UNKNOWN_SECRET });
    expect(response.status).toBe(200);
  });
});
