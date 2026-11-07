import { SELF, reset, runInDurableObject } from 'cloudflare:test';
import { ConnectorFrameType, HttpStatus, INSTALL_PAGE_PATH_PREFIX, MessageKind, WakeMode } from '@zapbip/types';
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
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.9';
const INSTALL_LINK_PATTERN = new RegExp(`${INSTALL_PAGE_PATH_PREFIX}zb_inst_[A-Za-z0-9_-]+`);
const CONNECTION_SECRET_IN_PAGE_PATTERN = /\/c\/(zb_conn_[A-Za-z0-9_-]+)\//;
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

async function installPageSecretOf(): Promise<string> {
  const screen = await SELF.fetch(`${ORIGIN}/dev/owner/${PHONE}/screen`);
  const { entries } = (await screen.json()) as { entries: Array<{ text: string }> };
  const installPath = entries
    .map((entry) => entry.text)
    .join('\n')
    .match(INSTALL_LINK_PATTERN);
  if (installPath === null) throw new Error('the screen carries no install link');
  const page = await SELF.fetch(`${ORIGIN}${installPath[0]}`, { headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } });
  const secret = (await page.text()).match(CONNECTION_SECRET_IN_PAGE_PATTERN);
  if (secret === null) throw new Error('the install page carries no connection link');
  return secret[1];
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

  it('the install page hands out the secret the connector route admits and the object knows', async () => {
    await say({ text: 'oi' });
    await say({ text: `novo agente ${AGENT}` });
    const session = await openConnector({ secret: await installPageSecretOf() });
    expect(await session.nextFrame()).toEqual({ type: ConnectorFrameType.Hello, agent: AGENT, previousWakeMode: WakeMode.None });
    expect(await objectKnowsCurrentKey({ agent: AGENT })).toBe(true);
    session.socket.close();
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
