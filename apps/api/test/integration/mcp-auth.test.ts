import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_SECRET_PREFIX, UNAUTHORIZED_BODY } from '../../src/contract/constants';
import { LogEvent } from '../../src/contract/log';
import { postMcp, seedConnectionWithSecret, type SeededConnection } from './mcp-fixtures';
import { applyDirectoryMigration } from '../support/seed';
import { reset } from 'cloudflare:test';

const UNKNOWN_SECRET = `${CONNECTION_SECRET_PREFIX}${'A'.repeat(43)}`;
const MALFORMED_SECRET = `${CONNECTION_SECRET_PREFIX}short`;
const UNAUTHORIZED_TEXT = JSON.stringify(UNAUTHORIZED_BODY);

describe('MCP secret and Bearer resolution', () => {
  let connection: SeededConnection;

  afterEach(() => {
    vi.restoreAllMocks();
    return reset();
  });

  beforeEach(async () => {
    await applyDirectoryMigration();
    connection = await seedConnectionWithSecret({ accountId: 'acc_1', agent: 'alpha' });
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

  it('[row 417] writes no log line that carries the route or the secret for an accepted request', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    const response = await postMcp({ path: `/c/${connection.secret}/mcp` });
    expect(response.status).toBe(200);
    const output = lines.join('\n');
    expect(output).not.toContain(connection.secret);
    expect(output).not.toContain(CONNECTION_SECRET_PREFIX);
    expect(output).not.toContain('/mcp');
  });

  it('[row 418] logs auth_rejected once for an unknown secret and never the secret', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    await postMcp({ path: `/c/${UNKNOWN_SECRET}/mcp` });
    const rejections = lines.filter((line) => line.includes(LogEvent.AuthRejected));
    expect(rejections).toEqual([JSON.stringify({ event: LogEvent.AuthRejected })]);
    expect(lines.join('\n')).not.toContain(UNKNOWN_SECRET);
  });
});
