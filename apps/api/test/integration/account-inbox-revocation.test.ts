import { OwnerLocale } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openWindow, receiveOwnerText } from '../support/inbox-session';
import { applyDirectoryMigration } from '../support/seed';
import { accountInboxStub, connectionOf } from '../support/workers-env';

const ACCOUNT = 'acc_revocation';
const OLD_AGENT = 'alpha';
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
});

beforeEach(applyDirectoryMigration);
