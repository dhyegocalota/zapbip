import { OwnerLocale, REVOKED_CLOSE_CODE } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openWindow, receiveOwnerText } from '../support/inbox-session';
import { openConnector } from '../support/connector-session';
import { applyDirectoryMigration, seedAccount, seedConnection, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, connectionOf } from '../support/workers-env';

const ACCOUNT = 'acc_revocation';
const OLD_AGENT = 'alpha';
const CONNECTOR_SECRET = `zb_conn_${'D'.repeat(43)}`;
const OWNER_PHONE = '5511900000051';
const WAKE_REQUESTED_KEY = `wake_last_requested_at:${OLD_AGENT}`;
const PENDING_WAKE_JOB_STATEMENT = 'INSERT INTO wake_jobs (agent, due_at, attempt, lease_until, rewake) VALUES (?, 1, 0, NULL, 0)';
const ANSWERED_QUESTION_STATEMENT = `INSERT INTO questions (question_id, agent, text, options, normalized_key, prompt_message_id, asked_at, answer)
  VALUES ('que_answered', ?, 'Deploy?', '[]', 'deploy', 'msg_prompt', 1, '{}')`;

function stubOf() {
  return accountInboxStub({ accountId: ACCOUNT });
}

function sql<Row extends Record<string, SqlStorageValue>>(statement: string, ...bindings: SqlStorageValue[]): Promise<Row[]> {
  return runInDurableObject(stubOf(), (_instance, state) => state.storage.sql.exec<Row>(statement, ...bindings).toArray());
}

async function agentSpoke(): Promise<void> {
  await openWindow({ stub: stubOf() });
  await stubOf().sendText({ connection: connectionOf({ accountId: ACCOUNT, agent: OLD_AGENT }), text: 'oi', replyToMessageId: null });
}

async function ownerWrites(input: { text: string }) {
  const outcome = await receiveOwnerText({ stub: stubOf(), text: input.text });
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

afterEach(reset);

describe('a revoked agent stops being a routing target', () => {
  it('closes its open questions when it is revoked', async () => {
    await agentSpoke();
    await stubOf().ask({
      connection: connectionOf({ accountId: ACCOUNT, agent: OLD_AGENT }),
      text: 'Deploy?',
      options: ['Sim', 'Nao'],
      optionDescriptions: [null, null],
      timeoutMs: 10,
    });
    await stubOf().recordRevocation({ agent: OLD_AGENT });
    expect(await sql('SELECT question_id FROM questions WHERE agent = ? AND answer IS NULL', OLD_AGENT)).toEqual([]);
  });

  it('does not send the next owner message to the last agent that wrote when that agent is revoked', async () => {
    await agentSpoke();
    await stubOf().recordRevocation({ agent: OLD_AGENT });
    expect((await ownerWrites({ text: 'e agora?' })).agent).toBeNull();
  });

  it('does not route to an open question of a revoked agent', async () => {
    await agentSpoke();
    await stubOf().recordRevocation({ agent: OLD_AGENT });
    await stubOf().ask({
      connection: connectionOf({ accountId: ACCOUNT, agent: OLD_AGENT }),
      text: 'Ainda aqui?',
      options: ['Sim', 'Nao'],
      optionDescriptions: [null, null],
      timeoutMs: 10,
    });
    expect((await ownerWrites({ text: 'sim' })).agent).toBeNull();
  });

  it('leaves a revoked agent out of the routing list', async () => {
    await agentSpoke();
    await stubOf().recordRevocation({ agent: OLD_AGENT });
    await ownerWrites({ text: 'alguem?' });
    const options = await sql<{ payload: string }>("SELECT payload FROM inbox_messages WHERE direction = 'to_owner' AND kind = 'choice'");
    expect(options.map((row) => row.payload).join('')).not.toContain(OLD_AGENT);
  });

  it('deletes the pending wake job of a revoked agent', async () => {
    await agentSpoke();
    await sql(PENDING_WAKE_JOB_STATEMENT, OLD_AGENT);
    await stubOf().recordRevocation({ agent: OLD_AGENT });
    expect(await sql('SELECT agent FROM wake_jobs WHERE agent = ?', OLD_AGENT)).toEqual([]);
  });

  it('[row 478][row 479] forgets the revoked name and its old history when the name is created again', async () => {
    await agentSpoke();
    await sql(ANSWERED_QUESTION_STATEMENT, OLD_AGENT);
    await stubOf().recordRevocation({ agent: OLD_AGENT });
    await stubOf().recordCreation({ agent: OLD_AGENT });
    expect(await sql('SELECT agent FROM revoked_agents')).toEqual([]);
    expect(await sql('SELECT question_id FROM questions WHERE agent = ?', OLD_AGENT)).toEqual([]);
    expect(await sql('SELECT id FROM inbox_messages WHERE agent = ?', OLD_AGENT)).toEqual([]);
    const inbox = await stubOf().checkInbox({
      connection: { accountId: ACCOUNT, agent: OLD_AGENT, ownerLocale: OwnerLocale.PortugueseBrazil },
    });
    expect(inbox.ok && inbox.value.messages).toEqual([]);
  });

  it('forgets the debounce of the revoked name so the recreated agent is woken at once', async () => {
    await runInDurableObject(stubOf(), (_instance, state) => state.storage.kv.put(WAKE_REQUESTED_KEY, 1));
    await stubOf().recordRevocation({ agent: OLD_AGENT });
    expect(await runInDurableObject(stubOf(), (_instance, state) => state.storage.kv.get(WAKE_REQUESTED_KEY))).toBeUndefined();
  });

  it('a recreated name inherits neither the old wake row nor the old connector socket', async () => {
    await seedOwnerIdentity({ accountId: ACCOUNT, phone: OWNER_PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
    await seedConnection({ accountId: ACCOUNT, agent: OLD_AGENT, secret: CONNECTOR_SECRET });
    const session = await openConnector({ secret: CONNECTOR_SECRET });
    await session.nextFrame();
    expect(await sql('SELECT agent FROM agent_wake WHERE agent = ?', OLD_AGENT)).toHaveLength(1);
    await stubOf().recordCreation({ agent: OLD_AGENT });
    expect(await sql('SELECT agent FROM agent_wake WHERE agent = ?', OLD_AGENT)).toEqual([]);
    expect(await session.closeCode()).toBe(REVOKED_CLOSE_CODE);
  });
});

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedAccount({ accountId: ACCOUNT });
});
