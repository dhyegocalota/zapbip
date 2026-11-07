import { reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { AGENT_RULES, AGENT_RULES_PROMPT_NAME } from '@zapbip/core';
import { CLIENT_NAME_MAX_CHARS, INITIALIZE_BODY_MAX_BYTES } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectClient, MCP_REQUEST_HEADERS, seedConnectionWithSecret, type SeededConnection } from './mcp-fixtures';
import { applyDirectoryMigration } from '../support/seed';
import { testEnv } from '../support/workers-env';

const ORIGIN = 'http://localhost:8787';
const CLIENT_NAME = 'Claude Code';
const OTHER_CLIENT_NAME = 'Codex';
const ACCOUNT_ID = 'acc_1';
const AGENT = 'alpha';
const OK_STATUS = 200;
const SERVER_ERROR_STATUS = 500;
const BAD_REQUEST_STATUS = 400;
const REFUSAL_OBSERVATION_MS = 500;

type ConnectionColumns = { clientName: string | null; firstCallAt: number | null };

function initializeBody(input: { name: unknown; padding?: number }): string {
  const { padding = 0 } = input;
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: input.name, version: '1', padding: 'x'.repeat(padding) },
    },
  });
}

function postBody(input: { connection: SeededConnection; body: string; contentLength?: number }): Promise<Response> {
  const { contentLength = new TextEncoder().encode(input.body).byteLength } = input;
  return exports.default.fetch(
    new Request(`${ORIGIN}/c/${input.connection.secret}/mcp`, {
      method: 'POST',
      headers: { ...MCP_REQUEST_HEADERS, 'content-length': String(contentLength) },
      body: input.body,
    }),
  );
}

function readColumns(input: { connection: SeededConnection }): Promise<ConnectionColumns | null> {
  return testEnv.CONNECTIONS.prepare(
    'SELECT client_name AS clientName, first_call_at AS firstCallAt FROM connections WHERE secret_digest = ?',
  )
    .bind(input.connection.secretDigest)
    .first<ConnectionColumns>();
}

async function waitForClientName(input: { connection: SeededConnection; clientName: string }): Promise<void> {
  await vi.waitFor(async () => expect((await readColumns(input))?.clientName).toBe(input.clientName));
}

describe('MCP install lifecycle', () => {
  let connection: SeededConnection;

  beforeEach(async () => {
    await applyDirectoryMigration();
    connection = await seedConnectionWithSecret({ accountId: ACCOUNT_ID, agent: AGENT });
  });
  afterEach(reset);

  it('IS-W1 returns the agent rules as the initialize instructions', async () => {
    const client = await connectClient({ secret: connection.secret });
    expect(client.getInstructions()).toBe(AGENT_RULES);
  });

  it('IS-W2 lists and serves the zapbip-rules prompt with the same text', async () => {
    const client = await connectClient({ secret: connection.secret });
    const listed = await client.listPrompts();
    const prompt = await client.getPrompt({ name: AGENT_RULES_PROMPT_NAME });
    expect(listed.prompts.map((candidate) => candidate.name)).toContain(AGENT_RULES_PROMPT_NAME);
    expect(prompt.messages.map((message) => message.content)).toEqual([{ type: 'text', text: AGENT_RULES }]);
  });

  it('IS-W4 records the client name from the first initialize', async () => {
    const response = await postBody({ connection, body: initializeBody({ name: CLIENT_NAME }) });
    expect(response.status).toBe(OK_STATUS);
    await waitForClientName({ connection, clientName: CLIENT_NAME });
  });

  it('IS-W4b does not overwrite the client name on a second initialize', async () => {
    await postBody({ connection, body: initializeBody({ name: CLIENT_NAME }) });
    await waitForClientName({ connection, clientName: CLIENT_NAME });
    await postBody({ connection, body: initializeBody({ name: OTHER_CLIENT_NAME }) });
    await vi.waitFor(async () => expect((await readColumns({ connection }))?.firstCallAt).not.toBeNull());
    expect((await readColumns({ connection }))?.clientName).toBe(CLIENT_NAME);
  });

  it('IS-W5 records no name for a body over the cap', async () => {
    const response = await postBody({ connection, body: initializeBody({ name: CLIENT_NAME, padding: INITIALIZE_BODY_MAX_BYTES }) });
    expect(response.status).toBe(OK_STATUS);
    await vi.waitFor(async () => expect((await readColumns({ connection }))?.firstCallAt).not.toBeNull());
    expect((await readColumns({ connection }))?.clientName).toBeNull();
  });

  it('IS-W6 handles a name over the cap like before and writes no name', async () => {
    const response = await postBody({ connection, body: initializeBody({ name: 'x'.repeat(CLIENT_NAME_MAX_CHARS + 1) }) });
    expect(response.status).toBe(OK_STATUS);
    await vi.waitFor(async () => expect((await readColumns({ connection }))?.firstCallAt).not.toBeNull());
    expect((await readColumns({ connection }))?.clientName).toBeNull();
  });

  it.each([{ title: 'text that is not JSON', body: 'not json' }])(
    'IS-W6b a refused call with $title does not consume the install code',
    async ({ body }) => {
      const response = await postBody({ connection, body });
      expect(response.status).toBeGreaterThanOrEqual(BAD_REQUEST_STATUS);
      expect(response.status).toBeLessThan(SERVER_ERROR_STATUS);
      const recordedLater = vi.waitFor(async () => expect((await readColumns({ connection }))?.firstCallAt).not.toBeNull(), {
        timeout: REFUSAL_OBSERVATION_MS,
      });
      await expect(recordedLater).rejects.toThrow();
      expect((await readColumns({ connection }))?.firstCallAt).toBeNull();
    },
  );

  it('IS-W8 writes the first call once', async () => {
    await postBody({ connection, body: initializeBody({ name: CLIENT_NAME }) });
    await vi.waitFor(async () => expect((await readColumns({ connection }))?.firstCallAt).not.toBeNull());
    const first = (await readColumns({ connection }))?.firstCallAt;
    await postBody({ connection, body: initializeBody({ name: CLIENT_NAME }) });
    expect((await readColumns({ connection }))?.firstCallAt).toBe(first);
  });
});
