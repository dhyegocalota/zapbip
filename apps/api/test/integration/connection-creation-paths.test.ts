import { SELF, reset, runInDurableObject } from 'cloudflare:test';
import { ConnectorFrameType, HttpStatus, MessageKind, WakeMode } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isCurrentKeyDigest } from '../../src/account-inbox/agent-key-digest';
import { DEV_SEED_PATH } from '../../src/contract/constants';
import { openConnector } from '../support/connector-session';
import { applyDirectoryMigration } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';

const ORIGIN = 'http://example.com';
const PHONE = '5511999990000';
const AGENT = 'alpha';
const SECOND_AGENT = 'beta';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CONNECTION_STATEMENT = `SELECT account_id AS accountId, secret_digest AS secretDigest FROM connections
  WHERE agent = ?1 AND revoked_at IS NULL AND account_id = (SELECT account_id FROM owner_identities WHERE wa_id = ?2)`;

type SeededConnection = { agent: string; secret: string };
type StoredConnection = { accountId: string; secretDigest: string };

function seedDirectory(input: { phone: string; agents: string[] }): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${DEV_SEED_PATH}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) });
}

function say(input: { text: string }): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/dev/owner/${PHONE}/messages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind: MessageKind.Text, text: input.text }),
  });
}

async function storedConnectionOf(input: { agent: string }): Promise<StoredConnection> {
  const row = await testEnv.CONNECTIONS.prepare(CONNECTION_STATEMENT).bind(input.agent, PHONE).first<StoredConnection>();
  if (row === null) throw new Error(`no active connection for ${input.agent}`);
  return row;
}

async function objectKnowsCurrentKey(input: { agent: string }): Promise<boolean> {
  const { accountId, secretDigest } = await storedConnectionOf(input);
  return runInDurableObject(accountInboxStub({ accountId }), (_instance, state) =>
    isCurrentKeyDigest({ storage: state.storage, agent: input.agent, secretDigest }),
  );
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('connection creation paths', () => {
  it('the development seed hands out secrets the connector route admits', async () => {
    const response = await seedDirectory({ phone: PHONE, agents: [AGENT, SECOND_AGENT] });
    const { connections } = (await response.json()) as { connections: SeededConnection[] };
    expect(response.status).toBe(HttpStatus.Ok);
    const sessions = await Promise.all(connections.map((connection) => openConnector({ secret: connection.secret })));
    const firstFrames = await Promise.all(sessions.map((session) => session.nextFrame()));
    expect(firstFrames).toEqual(
      connections.map((connection) => ({ type: ConnectorFrameType.Hello, agent: connection.agent, previousWakeMode: WakeMode.None })),
    );
    sessions.forEach((session) => session.socket.close());
  });

  it('refuses a second seed of the same phone', async () => {
    await seedDirectory({ phone: PHONE, agents: [AGENT] });
    const response = await seedDirectory({ phone: PHONE, agents: [SECOND_AGENT] });
    expect(response.status).toBe(HttpStatus.BadRequest);
  });

  it('refuses a malformed seed body', async () => {
    const response = await SELF.fetch(`${ORIGIN}${DEV_SEED_PATH}`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
    expect(response.status).toBe(HttpStatus.BadRequest);
  });

  it.each([
    ['the development seed', async () => void (await seedDirectory({ phone: PHONE, agents: [AGENT] }))],
    [
      'the novo agente command',
      async () => {
        await say({ text: 'oi' });
        await say({ text: `novo agente ${AGENT}` });
      },
    ],
    [
      'the girar command',
      async () => {
        await say({ text: 'oi' });
        await say({ text: `novo agente ${AGENT}` });
        await say({ text: `girar ${AGENT}` });
      },
    ],
  ])('%s leaves the object holding the key digest it stored in the directory', async (_name, createConnection) => {
    await createConnection();
    expect(await objectKnowsCurrentKey({ agent: AGENT })).toBe(true);
  });
});
