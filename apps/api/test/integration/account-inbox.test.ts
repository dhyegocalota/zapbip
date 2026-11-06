import { formatOptionId, QUEUE_RETENTION_MS, ROUTING_LIST_TTL_MS, UPLOAD_TTL_MS, WINDOW_MS } from '@zapbip/core';
import { HOUR_MS, DeliveryState, InboxErrorCode, MediaSourceKind, MessageKind, ReplyStatus, TemplateKind } from '@zapbip/types';
import { abortAllDurableObjects, evictDurableObject, reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';
import { runMigrations, type Migration } from '../../src/account-inbox/run-migrations';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { createSqliteInboxRepository } from '../../src/adapters/sqlite/sqlite-inbox-repository';
import type { CallOutcome } from '../../src/contract/account-inbox-rpc';
import { LogEvent } from '../../src/contract/log';
import {
  advanceClock,
  openWindow,
  readScreen,
  receiveOwnerContent,
  receiveOwnerText,
  registerDueTimeProvider,
} from '../support/inbox-session';
import { accountInboxStub, connectionOf, testEnv } from '../support/workers-env';

const FIRST_ACCOUNT = 'acc_one';
const SECOND_ACCOUNT = 'acc_two';
const HELD_ASK_TIMEOUT_MS = 10_000;
const SHORT_ASK_TIMEOUT_MS = 1_000;
const MEDIA_KEY_PREFIX = 'accounts';
const LOG_SECRET_TEXT = 'segredo-123';
const LOG_SECRET_CAPTION = 'legenda-456';
const LOG_SECRET_FILENAME = 'contract.pdf';

function stubOf(input: { accountId: string }) {
  return accountInboxStub(input);
}

function expectOk<Value>(outcome: CallOutcome<Value>): Value {
  if (!outcome.ok) throw new Error(`expected ok, received ${outcome.errorCode}: ${outcome.message}`);
  return outcome.value;
}

async function sendAlphaText(input: { accountId: string; text: string }) {
  return expectOk(
    await stubOf(input).sendText({
      connection: connectionOf({ accountId: input.accountId, agent: 'alpha' }),
      text: input.text,
      replyToMessageId: null,
    }),
  );
}

async function readStorage<Result>(input: {
  accountId: string;
  read: (storage: DurableObjectStorage) => Promise<Result> | Result;
}): Promise<Result> {
  return runInDurableObject(stubOf(input), (_instance, state) => input.read(state.storage));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('AccountInbox state', () => {
  it('WI-14 keeps state across a restart', async () => {
    const sent = await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    await evictDurableObject(stubOf({ accountId: FIRST_ACCOUNT }));
    const { history } = expectOk(
      await stubOf({ accountId: FIRST_ACCOUNT }).getMessages({
        connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }),
        limit: 20,
      }),
    );
    expect(history.map((message) => message.messageId)).toEqual([sent.messageId]);
  });

  it('WI-15 isolates two accounts', async () => {
    await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    const { history } = expectOk(
      await stubOf({ accountId: SECOND_ACCOUNT }).getMessages({
        connection: connectionOf({ accountId: SECOND_ACCOUNT, agent: 'alpha' }),
        limit: 20,
      }),
    );
    expect(history).toEqual([]);
    expect(await readScreen({ stub: stubOf({ accountId: SECOND_ACCOUNT }) })).toEqual([]);
  });

  it('WI-24 keeps the error code across the RPC', async () => {
    const outcome = await stubOf({ accountId: FIRST_ACCOUNT }).sendText({
      connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }),
      text: 'oi',
      replyToMessageId: 'msg_missing',
    });
    expect(outcome).toEqual({ ok: false, errorCode: InboxErrorCode.NotFound, message: 'reply_to: message not found' });
  });
});

describe('AccountInbox owner messages', () => {
  it('WI-20 drops a duplicate channel message', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    const first = expectOk(await receiveOwnerText({ stub, text: 'resposta', channelMessageId: 'wamid.dup' }));
    const second = expectOk(await receiveOwnerText({ stub, text: 'resposta', channelMessageId: 'wamid.dup' }));
    const ownerMessageCount = await readStorage({
      accountId: FIRST_ACCOUNT,
      read: (storage) =>
        storage.sql.exec<{ total: number }>("SELECT COUNT(*) AS total FROM inbox_messages WHERE direction = 'from_owner'").one().total,
    });
    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ messageId: first.messageId, agent: first.agent, duplicate: true });
    expect(ownerMessageCount).toBe(1);
  });

  it('WI-22 lists the screen in send order', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const connection = connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' });
    await openWindow({ stub });
    const text = expectOk(await stub.sendText({ connection, text: 'oi', replyToMessageId: null }));
    expectOk(await stub.ask({ connection, text: 'Deploy?', options: ['Sim', 'Nao'], optionDescriptions: [null, null], timeoutMs: 50 }));
    await advanceClock({ stub, advanceMs: WINDOW_MS });
    await stub.sendText({ connection, text: 'de novo', replyToMessageId: null });
    const screen = await readScreen({ stub });
    expect(screen.map((entry) => entry.template)).toEqual([null, null, TemplateKind.Notice]);
    expect(screen.map((entry) => entry.options)).toEqual([[], ['Sim', 'Nao'], []]);
    expect(screen[0]?.text).toBe('oi');
    expect(screen[1]?.text).toBe('Deploy?');
    expect(screen[0]?.messageId).toBe(text.messageId);
    expect(screen[2]?.messageId).toBeNull();
  });

  it('renders an outbound link media on the screen as its placeholder and link', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const connection = connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' });
    const link = 'https://example.com/a.jpg';
    await openWindow({ stub });
    expectOk(
      await stub.sendMedia({
        connection,
        mediaKind: MessageKind.Image,
        voice: false,
        source: { kind: MediaSourceKind.Link, link },
        caption: null,
        filename: null,
        replyToMessageId: null,
      }),
    );
    const screen = await readScreen({ stub });
    expect(screen.at(-1)?.text).toBe(`[imagem] ${link}`);
  });

  it('renders the routing list for an unrouted owner text', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await stub.checkInbox({ connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }) });
    await advanceClock({ stub, advanceMs: 1 });
    await stub.checkInbox({ connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'beta' }) });
    await openWindow({ stub });
    expectOk(await receiveOwnerText({ stub, text: 'oi' }));
    const screen = await readScreen({ stub });
    expect(screen.map((entry) => entry.options)).toEqual([['beta', 'alpha']]);
    expect(screen[0]?.template).toBeNull();
  });

  it('WI-23 holds an unanswered ask and returns pending', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await openWindow({ stub });
    const startedAt = Date.now();
    const value = expectOk(
      await stub.ask({
        connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }),
        text: 'Deploy?',
        options: ['Sim'],
        optionDescriptions: [null],
        timeoutMs: SHORT_ASK_TIMEOUT_MS,
      }),
    );
    expect(value.status).toBe(ReplyStatus.Pending);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(SHORT_ASK_TIMEOUT_MS - 100);
  });

  it('WI-25 recovers an answer after the object is evicted mid-wait', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const connection = connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' });
    await openWindow({ stub });
    const held = stub.ask({ connection, text: 'Deploy?', options: ['Sim'], optionDescriptions: [null], timeoutMs: HELD_ASK_TIMEOUT_MS });
    const heldOutcome = held.then(
      () => 'resolved',
      () => 'rejected',
    );
    const questionId = await vi.waitFor(async () => {
      const row = await readStorage({
        accountId: FIRST_ACCOUNT,
        read: (storage) => storage.sql.exec<{ question_id: string }>('SELECT question_id FROM questions').toArray()[0],
      });
      if (row === undefined) throw new Error('question not stored yet');
      return row.question_id;
    });
    await abortAllDurableObjects();
    expect(await heldOutcome).toBe('rejected');
    const freshStub = stubOf({ accountId: FIRST_ACCOUNT });
    await receiveOwnerContent({
      stub: freshStub,
      content: {
        kind: MessageKind.Choice,
        optionId: formatOptionId({ questionId, optionIndex: 0 }),
        optionTitle: 'Sim',
        optionDescription: null,
      },
    });
    const retried = expectOk(await freshStub.waitForReply({ connection, questionId, timeoutMs: SHORT_ASK_TIMEOUT_MS }));
    expect(retried).toMatchObject({ status: ReplyStatus.Answered, answer: 'Sim' });
  });
});

describe('AccountInbox alarm', () => {
  it('WI-16 sweeps an expired upload and its object', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const connection = connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' });
    const upload = expectOk(await stub.createUpload({ connection, filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 3 }));
    const objectKey = `${MEDIA_KEY_PREFIX}/${FIRST_ACCOUNT}/media/${upload.uploadId}`;
    await testEnv.MEDIA.put(objectKey, new Uint8Array([1, 2, 3]));
    await advanceClock({ stub, advanceMs: UPLOAD_TTL_MS + 1 });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await stub.describeUpload({ mediaId: upload.uploadId })).toMatchObject({ ok: false, errorCode: InboxErrorCode.NotFound });
    expect(await testEnv.MEDIA.get(objectKey)).toBeNull();
  });

  it('WI-125 runs the routing list expiry from the alarm and arms it again', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await stub.checkInbox({ connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }) });
    await openWindow({ stub });
    expectOk(await receiveOwnerText({ stub, text: 'oi' }));
    await advanceClock({ stub, advanceMs: ROUTING_LIST_TTL_MS });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const screen = await readScreen({ stub });
    expect(screen.map((entry) => entry.options)).toEqual([['alpha'], ['alpha']]);
    expect(await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm())).not.toBeNull();
  });

  it('WI-17 expires a queued message past its retention', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const queued = await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    expect(queued.delivery).toBe(DeliveryState.Queued);
    await advanceClock({ stub, advanceMs: QUEUE_RETENTION_MS + 1 });
    await runDurableObjectAlarm(stub);
    const { history } = expectOk(
      await stub.getMessages({ connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }), limit: 20 }),
    );
    expect(history.map((message) => message.delivery)).toEqual([DeliveryState.Expired]);
  });

  it('WI-18 arms the alarm at the next expiry after an upload', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    expectOk(
      await stub.createUpload({
        connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }),
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3,
      }),
    );
    const { armed, next } = await runInDurableObject(stub, async (_instance, state) => ({
      armed: await state.storage.getAlarm(),
      next: await createSqliteInboxRepository({ storage: state.storage, clock: createPlatformClock() }).findNextExpiry(),
    }));
    expect(armed).not.toBeNull();
    expect(armed).toBe(next);
  });

  it('WI-19 moves the armed alarm earlier', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    const armedBefore = await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm());
    expectOk(
      await stub.createUpload({
        connection: connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' }),
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3,
      }),
    );
    const armedAfter = await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm());
    if (armedBefore === null || armedAfter === null) throw new Error('alarm was not armed');
    expect(armedAfter).toBeLessThan(armedBefore);
  });

  it('WI-123 keeps the alarm armed when a due-time provider throws', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const firstDueAt = Date.now() + 60_000;
    const secondDueAt = Date.now() + 120_000;
    const secondRuns = vi.fn();
    await registerDueTimeProvider({
      stub,
      provider: {
        nextDueAt: async () => firstDueAt,
        runDue: async () => {
          throw new Error('provider failed');
        },
      },
    });
    await registerDueTimeProvider({ stub, provider: { nextDueAt: async () => secondDueAt, runDue: async () => secondRuns() } });
    await runInDurableObject(stub, (_instance, state) => state.storage.setAlarm(Date.now() + HOUR_MS));
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const armed = await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm());
    expect(secondRuns).toHaveBeenCalledTimes(1);
    expect(armed).toBe(firstDueAt);
  });
});

describe('AccountInbox alarm and clock', () => {
  it('arms the alarm at the clock deadline after the clock advances', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    const offsetMs = await advanceClock({ stub, advanceMs: WINDOW_MS });
    const { armed, next } = await runInDurableObject(stub, async (_instance, state) => ({
      armed: await state.storage.getAlarm(),
      next: await createSqliteInboxRepository({ storage: state.storage, clock: createPlatformClock() }).findNextExpiry(),
    }));
    if (next === null) throw new Error('nothing expires');
    expect(armed).toBe(next - offsetMs);
  });

  it('re-arms the alarm when the object is constructed again', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    await runInDurableObject(stub, (_instance, state) => state.storage.deleteAlarm());
    await evictDurableObject(stub);
    const armed = await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm());
    expect(armed).not.toBeNull();
  });
});

describe('AccountInbox development clock', () => {
  it('WI-21 keeps the clock offset across a restart', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    await openWindow({ stub });
    expect(await advanceClock({ stub, advanceMs: WINDOW_MS })).toBe(WINDOW_MS);
    await evictDurableObject(stub);
    const outcome = await sendAlphaText({ accountId: FIRST_ACCOUNT, text: 'oi' });
    expect(outcome.delivery).toBe(DeliveryState.Queued);
  });
});

describe('AccountInbox migrations', () => {
  it('WI-118 migrates a fresh object', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const { versions, tables } = await runInDurableObject(stub, async (_instance, state) => ({
      versions: state.storage.sql
        .exec<{ version: number }>('SELECT version FROM schema_versions')
        .toArray()
        .map((row) => row.version),
      tables: state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .toArray()
        .map((row) => row.name),
    }));
    expect(versions).toEqual([1, 4]);
    expect(tables).toEqual(
      expect.arrayContaining([
        'inbox_messages',
        'questions',
        'channel_receipts',
        'agent_wake',
        'owner_window',
        'agents',
        'media',
        'screen_entries',
      ]),
    );
  });

  it('WI-119 applies nothing on a second run', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const applied = await runInDurableObject(stub, async (_instance, state) =>
      runMigrations({ storage: state.storage, migrations: ACCOUNT_INBOX_MIGRATIONS }),
    );
    expect(applied).toEqual([]);
  });

  it('WI-120 applies the missing versions in ascending order', async () => {
    const migrations: Migration[] = [
      { version: 3, sql: 'CREATE TABLE three (id INTEGER)' },
      ...ACCOUNT_INBOX_MIGRATIONS,
      { version: 2, sql: 'CREATE TABLE two (id INTEGER)' },
    ];
    const applied = await runInDurableObject(stubOf({ accountId: FIRST_ACCOUNT }), async (_instance, state) =>
      runMigrations({ storage: state.storage, migrations }),
    );
    expect(applied).toEqual([2, 3]);
  });

  it('WI-121 fills a gap and orders an unsorted registry', async () => {
    const gapApplied = await runInDurableObject(stubOf({ accountId: FIRST_ACCOUNT }), async (_instance, state) =>
      runMigrations({
        storage: state.storage,
        migrations: [...ACCOUNT_INBOX_MIGRATIONS, { version: 3, sql: 'CREATE TABLE three (id INTEGER)' }],
      }),
    );
    const unsortedApplied = await runInDurableObject(stubOf({ accountId: SECOND_ACCOUNT }), async (_instance, state) => {
      state.storage.sql.exec('DELETE FROM schema_versions');
      return runMigrations({
        storage: state.storage,
        migrations: [
          { version: 2, sql: 'CREATE TABLE two (id INTEGER)' },
          { version: 1, sql: 'CREATE TABLE one (id INTEGER)' },
        ],
      });
    });
    expect(gapApplied).toEqual([3]);
    expect(unsortedApplied).toEqual([1, 2]);
  });
});

describe('AccountInbox logs', () => {
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('WI-26 never logs text, captions, file names or secrets', async () => {
    const stub = stubOf({ accountId: FIRST_ACCOUNT });
    const connection = connectionOf({ accountId: FIRST_ACCOUNT, agent: 'alpha' });
    await openWindow({ stub });
    await stub.sendText({ connection, text: LOG_SECRET_TEXT, replyToMessageId: null });
    await receiveOwnerText({ stub, text: LOG_SECRET_TEXT });
    await stub.sendMedia({
      connection,
      mediaKind: MessageKind.Document,
      voice: false,
      source: { kind: MediaSourceKind.Link, link: 'https://example.com/a.pdf' },
      caption: LOG_SECRET_CAPTION,
      filename: LOG_SECRET_FILENAME,
      replyToMessageId: null,
    });
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    const events = lines.map((line) => JSON.parse(line).event);
    expect(lines.length).toBeGreaterThan(0);
    expect(events.every((event) => Object.values(LogEvent).includes(event))).toBe(true);
    [LOG_SECRET_TEXT, LOG_SECRET_CAPTION, LOG_SECRET_FILENAME].forEach((forbidden) => {
      expect(lines.some((line) => line.includes(forbidden))).toBe(false);
    });
  });
});
