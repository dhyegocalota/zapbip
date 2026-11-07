import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { INSTALL_CODE_TTL_MS, OwnerLocale } from '@zapbip/types';
import { mcpRoutes } from '../../src/routes/mcp';
import { registerWithInstallCode } from '../support/install-codes';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';
import { MCP_REQUEST_HEADERS } from './mcp-fixtures';

const CLIENT_NAME = 'Claude Code';
const READ_PREFIX = 'SELECT';
const SELECT_ACTIVITY = 'SELECT client_name AS clientName, first_call_at AS firstCallAt FROM connections WHERE secret_digest = ?';

function initializeBody(): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: CLIENT_NAME, version: '1' } },
  });
}

function countReads(input: { database: D1Database; statements: string[] }): D1Database {
  return new Proxy(input.database, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (property !== 'prepare') return typeof value === 'function' ? value.bind(target) : value;
      return (statement: string) => {
        input.statements.push(statement);
        return target.prepare(statement);
      };
    },
  });
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('MCP hot path', () => {
  it('IS-S8 resolves the connection and its activity with one D1 read per request, and still records them', async () => {
    const accountId = `acc_${crypto.randomUUID()}`;
    await seedOwnerIdentity({ accountId, phone: '5511999990001', ownerLocale: OwnerLocale.PortugueseBrazil });
    const { secret, connection } = await registerWithInstallCode({
      accountId,
      agent: 'claude',
      expiresAt: Date.now() + INSTALL_CODE_TTL_MS,
    });
    const body = initializeBody();
    const statements: string[] = [];
    const pending: Promise<unknown>[] = [];
    const response = await mcpRoutes.request(
      `/c/${secret}/mcp`,
      { method: 'POST', headers: { ...MCP_REQUEST_HEADERS, 'content-length': String(new TextEncoder().encode(body).byteLength) }, body },
      { ...testEnv, CONNECTIONS: countReads({ database: testEnv.CONNECTIONS, statements }) },
      { waitUntil: (work: Promise<unknown>) => pending.push(work), passThroughOnException: () => undefined } as unknown as ExecutionContext,
    );
    await Promise.all(pending);
    expect(response.status).toBe(200);
    expect(statements.filter((statement) => statement.trimStart().startsWith(READ_PREFIX))).toHaveLength(1);
    const row = await testEnv.CONNECTIONS.prepare(SELECT_ACTIVITY)
      .bind(connection.secretDigest)
      .first<{ clientName: string | null; firstCallAt: number | null }>();
    expect(row?.clientName).toBe(CLIENT_NAME);
    expect(row?.firstCallAt).not.toBeNull();
  });
});
