import { RECEIPT_RETENTION_MS, type ChannelStatusDetail, type CoreDependencies } from '@zapbip/core';
import { ChannelInboundKind, DeliveryState, MediaOrigin, MessageDirection, MessageKind, OwnerLocale } from '@zapbip/types';
import { evictDurableObject, reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountInbox } from '../../src/account-inbox/account-inbox';
import { SENDING_STALE_MS } from '../../src/adapters/whatsapp/whatsapp-constants';
import type { Bindings } from '../../src/contract/env';
import { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { withRepository } from '../support/account-inbox';
import { BASE_TIME, buildTextMessage } from '../support/builders';
import { advanceClock } from '../support/inbox-session';
import { accountInboxStub, connectionOf, testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_channel';
const CHANNEL_MESSAGE_ID = 'wamid.inbound.1';
const OUTBOUND_CHANNEL_MESSAGE_ID = 'wamid.outbound.1';
const ACCESS_TOKEN_VARIABLE = 'WHATSAPP_ACCESS_TOKEN';
const PRICING_CATEGORY = 'utility';
const ERROR_CODE = 131047;
const ERROR_TITLE = 'Re-engagement message';
const COUNT_OWNER_MESSAGES_STATEMENT = "SELECT COUNT(*) AS total FROM inbox_messages WHERE direction = 'from_owner'";
const COUNT_RECEIPTS_STATEMENT = 'SELECT COUNT(*) AS total FROM channel_receipts';
const EMPTY_DETAIL: ChannelStatusDetail = { errorCode: null, errorTitle: null, pricingCategory: null, billable: null };

type RepositoryInternals = { dependencies: CoreDependencies };
type SenderSelection = { createSender: (input: { mediaStore: CoreDependencies['mediaStore'] }) => Promise<unknown> | unknown };

function inRepository<Result>(run: Parameters<typeof withRepository<Result>>[0]['run']): Promise<Result> {
  return withRepository({ accountId: ACCOUNT_ID, run });
}

function ownerTextEntry(input: { text: string; at: number }) {
  return {
    kind: ChannelInboundKind.Owner as const,
    at: input.at,
    content: { kind: MessageKind.Text as const, text: input.text },
    replyToChannelMessageId: null,
    noticeText: null,
  };
}

function receiveText(input: { channelMessageId: string; text?: string }) {
  return accountInboxStub({ accountId: ACCOUNT_ID }).receiveChannelMessage({
    ownerLocale: OwnerLocale.PortugueseBrazil,
    channelMessageId: input.channelMessageId,
    entry: ownerTextEntry({ text: input.text === undefined ? 'oi' : input.text, at: Date.now() }),
  });
}

function countRows(input: { statement: string }) {
  return runInDurableObject(
    accountInboxStub({ accountId: ACCOUNT_ID }),
    (_instance, state) => state.storage.sql.exec<{ total: number }>(input.statement).one().total,
  );
}

function countOwnerMessages() {
  return countRows({ statement: COUNT_OWNER_MESSAGES_STATEMENT });
}

function countReceipts() {
  return countRows({ statement: COUNT_RECEIPTS_STATEMENT });
}

async function registerAlpha(): Promise<void> {
  await accountInboxStub({ accountId: ACCOUNT_ID }).checkInbox({ connection: connectionOf({ accountId: ACCOUNT_ID, agent: 'alpha' }) });
}

function injectDependency(input: { change: (dependencies: CoreDependencies) => void }) {
  return runInDurableObject(accountInboxStub({ accountId: ACCOUNT_ID }), (instance) => {
    input.change((instance as unknown as RepositoryInternals).dependencies);
  });
}

async function selectSender(input: { instanceClass: typeof AccountInbox; env: Bindings }): Promise<unknown> {
  return runInDurableObject(accountInboxStub({ accountId: ACCOUNT_ID }), async (instance) => {
    const withEnv = Object.create(instance, { env: { value: input.env } }) as SenderSelection;
    const createSender = (input.instanceClass.prototype as unknown as SenderSelection).createSender;
    return createSender.call(withEnv, { mediaStore: (instance as unknown as RepositoryInternals).dependencies.mediaStore });
  });
}

function withoutAccessToken(): Bindings {
  const { WHATSAPP_ACCESS_TOKEN: removed, ...rest } = testEnv;
  void removed;
  return rest;
}

afterEach(reset);

describe('SQLite repository channel methods', () => {
  it('commits the receipt, the message and the window in one call and refuses a second call', async () => {
    const message = buildTextMessage({ messageId: 'msg_in_1', direction: MessageDirection.FromOwner, agent: 'alpha', delivery: null });
    const window = { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: false, closedAt: null };
    const input = { channelMessageId: CHANNEL_MESSAGE_ID, receivedAt: BASE_TIME, message, answer: null, media: null, window };
    const result = await inRepository(async (repository) => {
      const first = await repository.commitChannelInbound(input);
      const second = await repository.commitChannelInbound(input);
      return {
        first,
        second,
        stored: await repository.findMessage({ messageId: 'msg_in_1' }),
        byChannelId: await repository.findMessageByChannelMessageId({ channelMessageId: CHANNEL_MESSAGE_ID }),
        window: await repository.findWindow(),
        receiptAgain: await repository.recordChannelReceipt({ wamid: CHANNEL_MESSAGE_ID, receivedAt: BASE_TIME }),
      };
    });
    expect(result.first).toBe(true);
    expect(result.second).toBe(false);
    expect(result.stored).toEqual(message);
    expect(result.byChannelId).toEqual(message);
    expect(result.window.lastOwnerMessageAt).toBe(BASE_TIME);
    expect(result.receiptAgain).toBe(false);
  });

  it('writes nothing for a window-only entry beyond the receipt and the window', async () => {
    const window = { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: false, closedAt: null };
    const result = await inRepository(async (repository, storage) => {
      const committed = await repository.commitChannelInbound({
        channelMessageId: CHANNEL_MESSAGE_ID,
        receivedAt: BASE_TIME,
        message: null,
        answer: null,
        media: null,
        window,
      });
      return {
        committed,
        messages: storage.sql.exec<{ total: number }>('SELECT COUNT(*) AS total FROM inbox_messages').one().total,
        window: await repository.findWindow(),
      };
    });
    expect(result).toEqual({ committed: true, messages: 0, window });
  });

  it('rolls the receipt, the message and the window back when the transaction throws', async () => {
    const existing = buildTextMessage({ messageId: 'msg_in_1', direction: MessageDirection.FromOwner, delivery: null });
    const window = { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: false, closedAt: null };
    const result = await inRepository(async (repository, storage) => {
      await repository.insertMessage({ message: existing });
      const failure = await repository
        .commitChannelInbound({
          channelMessageId: CHANNEL_MESSAGE_ID,
          receivedAt: BASE_TIME,
          message: existing,
          answer: null,
          media: null,
          window,
        })
        .then(
          () => null,
          (error: Error) => error,
        );
      return {
        failed: failure !== null,
        receipts: storage.sql.exec<{ total: number }>('SELECT COUNT(*) AS total FROM channel_receipts').one().total,
        window: await repository.findWindow(),
      };
    });
    expect(result.failed).toBe(true);
    expect(result.receipts).toBe(0);
    expect(result.window.lastOwnerMessageAt).toBeNull();
  });

  it('stores the media record and the answer in the same commit', async () => {
    const media = {
      mediaId: 'med_1',
      origin: MediaOrigin.Owner,
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      filename: null,
      expiresAt: null,
      receivedAt: BASE_TIME,
      retentionUntil: BASE_TIME + 1,
    };
    const window = { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: false, closedAt: null };
    const stored = await inRepository(async (repository) => {
      await repository.commitChannelInbound({
        channelMessageId: CHANNEL_MESSAGE_ID,
        receivedAt: BASE_TIME,
        message: null,
        answer: null,
        media,
        window,
      });
      return repository.findMedia({ mediaId: 'med_1' });
    });
    expect(stored).toEqual(media);
  });

  it('round-trips the channel-closed time of the window', async () => {
    const window = await inRepository(async (repository) => {
      await repository.saveWindow({ window: { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: true, closedAt: BASE_TIME + 5 } });
      return repository.findWindow();
    });
    expect(window).toEqual({ lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: true, closedAt: BASE_TIME + 5 });
  });

  it('saves the channel id of a message once and reads it both ways', async () => {
    const message = buildTextMessage({ messageId: 'msg_out_1', delivery: DeliveryState.Sent });
    const result = await inRepository(async (repository) => {
      await repository.insertMessage({ message });
      await repository.saveChannelMessageId({ messageId: 'msg_out_1', channelMessageId: OUTBOUND_CHANNEL_MESSAGE_ID });
      await repository.saveChannelMessageId({ messageId: 'msg_out_1', channelMessageId: 'wamid.outbound.other' });
      return {
        channelId: await repository.findChannelMessageId({ messageId: 'msg_out_1' }),
        message: await repository.findMessageByChannelMessageId({ channelMessageId: OUTBOUND_CHANNEL_MESSAGE_ID }),
        missingChannelId: await repository.findChannelMessageId({ messageId: 'msg_none' }),
        missingMessage: await repository.findMessageByChannelMessageId({ channelMessageId: 'wamid.none' }),
      };
    });
    expect(result.channelId).toBe(OUTBOUND_CHANNEL_MESSAGE_ID);
    expect(result.message).toEqual(message);
    expect(result.missingChannelId).toBeNull();
    expect(result.missingMessage).toBeNull();
  });

  it('refuses two messages with the same channel id', async () => {
    const failure = await inRepository(async (repository) => {
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_1' }) });
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_2' }) });
      await repository.saveChannelMessageId({ messageId: 'msg_1', channelMessageId: OUTBOUND_CHANNEL_MESSAGE_ID });
      return repository.saveChannelMessageId({ messageId: 'msg_2', channelMessageId: OUTBOUND_CHANNEL_MESSAGE_ID }).then(
        () => null,
        (error: Error) => error,
      );
    });
    expect(failure).not.toBeNull();
  });

  it('never writes a null over a stored status detail', async () => {
    const detail = await inRepository(async (repository, storage) => {
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_1' }) });
      await repository.saveChannelStatusDetail({
        messageId: 'msg_1',
        detail: { errorCode: ERROR_CODE, errorTitle: ERROR_TITLE, pricingCategory: PRICING_CATEGORY, billable: true },
      });
      await repository.saveChannelStatusDetail({ messageId: 'msg_1', detail: EMPTY_DETAIL });
      return storage.sql
        .exec<{ error_code: number; error_title: string; pricing_category: string; billable: number }>(
          'SELECT error_code, error_title, pricing_category, billable FROM inbox_messages WHERE id = ?',
          'msg_1',
        )
        .one();
    });
    expect(detail).toEqual({ error_code: ERROR_CODE, error_title: ERROR_TITLE, pricing_category: PRICING_CATEGORY, billable: 1 });
  });

  it('overwrites a stored status detail field with a new value and keeps the others', async () => {
    const detail = await inRepository(async (repository, storage) => {
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_1' }) });
      await repository.saveChannelStatusDetail({
        messageId: 'msg_1',
        detail: { errorCode: null, errorTitle: null, pricingCategory: PRICING_CATEGORY, billable: true },
      });
      await repository.saveChannelStatusDetail({
        messageId: 'msg_1',
        detail: { errorCode: ERROR_CODE, errorTitle: null, pricingCategory: null, billable: false },
      });
      return storage.sql
        .exec<{ error_code: number; pricing_category: string; billable: number }>(
          'SELECT error_code, pricing_category, billable FROM inbox_messages WHERE id = ?',
          'msg_1',
        )
        .one();
    });
    expect(detail).toEqual({ error_code: ERROR_CODE, pricing_category: PRICING_CATEGORY, billable: 0 });
  });

  it('claims each queued message once, oldest first, as sending', async () => {
    const queued = (index: number) =>
      buildTextMessage({ messageId: `msg_${index}`, delivery: DeliveryState.Queued, at: BASE_TIME + index });
    const claims = await inRepository(async (repository) => {
      await Promise.all([3, 1, 2].map((index) => repository.insertMessage({ message: queued(index) })));
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_sent', delivery: DeliveryState.Sent }) });
      const first = await repository.claimQueuedMessages({ claimedAt: BASE_TIME, limit: 2 });
      const second = await repository.claimQueuedMessages({ claimedAt: BASE_TIME, limit: 5 });
      const third = await repository.claimQueuedMessages({ claimedAt: BASE_TIME, limit: 5 });
      return { first, second, third, queuedLeft: await repository.listQueued() };
    });
    expect(claims.first.map((message) => message.messageId)).toEqual(['msg_1', 'msg_2']);
    expect(claims.first.map((message) => message.delivery)).toEqual([DeliveryState.Sending, DeliveryState.Sending]);
    expect(claims.second.map((message) => message.messageId)).toEqual(['msg_3']);
    expect(claims.third).toEqual([]);
    expect(claims.queuedLeft).toEqual([]);
  });

  it('returns only the stale claims to the queue', async () => {
    const delivery = await inRepository(async (repository) => {
      await repository.insertMessage({
        message: buildTextMessage({ messageId: 'msg_old', delivery: DeliveryState.Queued, at: BASE_TIME }),
      });
      await repository.insertMessage({
        message: buildTextMessage({ messageId: 'msg_new', delivery: DeliveryState.Queued, at: BASE_TIME + 1 }),
      });
      await repository.claimQueuedMessages({ claimedAt: BASE_TIME, limit: 1 });
      await repository.claimQueuedMessages({ claimedAt: BASE_TIME + SENDING_STALE_MS, limit: 1 });
      await repository.releaseStaleClaims({ claimedBefore: BASE_TIME + 1 });
      return Promise.all(['msg_old', 'msg_new'].map((messageId) => repository.findMessage({ messageId }))).then((messages) =>
        messages.map((message) => message?.delivery),
      );
    });
    expect(delivery).toEqual([DeliveryState.Queued, DeliveryState.Sending]);
  });

  it('keeps the alarm due for a message claimed as sending', async () => {
    const nextExpiry = await inRepository(async (repository) => {
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_1', delivery: DeliveryState.Queued, at: BASE_TIME }) });
      await repository.claimQueuedMessages({ claimedAt: BASE_TIME, limit: 1 });
      return repository.findNextExpiry();
    });
    expect(nextExpiry).toBe(BASE_TIME + SENDING_STALE_MS);
  });
});

describe('DO schema v4', () => {
  it('adds the channel columns, the closed time and the unique channel id', async () => {
    const schema = await runInDurableObject(accountInboxStub({ accountId: ACCOUNT_ID }), (_instance, state) => ({
      messageColumns: state.storage.sql
        .exec<{ name: string }>('PRAGMA table_info(inbox_messages)')
        .toArray()
        .map((column) => column.name),
      windowColumns: state.storage.sql
        .exec<{ name: string }>('PRAGMA table_info(owner_window)')
        .toArray()
        .map((column) => column.name),
      versions: state.storage.sql
        .exec<{ version: number }>('SELECT version FROM schema_versions ORDER BY version')
        .toArray()
        .map((row) => row.version),
    }));
    expect(schema.messageColumns).toEqual(
      expect.arrayContaining(['channel_message_id', 'error_code', 'error_title', 'pricing_category', 'billable', 'claimed_at']),
    );
    expect(schema.windowColumns).toContain('closed_at');
    expect(schema.versions).toEqual([1, 4]);
  });
});

describe('AccountInbox channel messages', () => {
  it('WI-8 commits an inbound message and reports a duplicate on the second delivery', async () => {
    await registerAlpha();
    const first = await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    const second = await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    expect(first).toMatchObject({ ok: true, value: { duplicate: false } });
    if (!first.ok) throw new Error('the first delivery failed');
    expect(second).toEqual({ ok: true, value: { ...first.value, duplicate: true } });
    expect(await countOwnerMessages()).toBe(1);
    expect(await countReceipts()).toBe(1);
  });

  it('WI-9 leaves nothing behind when a throw happens before the commit, and the retry stores once', async () => {
    await registerAlpha();
    await injectDependency({
      change: (dependencies) => {
        const commit = dependencies.repository.commitChannelInbound.bind(dependencies.repository);
        let calls = 0;
        dependencies.repository.commitChannelInbound = async (input) => {
          calls += 1;
          if (calls === 1) throw new Error('injected before the commit');
          return commit(input);
        };
      },
    });
    await expect(receiveText({ channelMessageId: CHANNEL_MESSAGE_ID })).rejects.toThrow('injected before the commit');
    expect(await countReceipts()).toBe(0);
    expect(await countOwnerMessages()).toBe(0);
    const retried = await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    expect(retried).toMatchObject({ ok: true, value: { duplicate: false } });
    expect(await countOwnerMessages()).toBe(1);
  });

  it('WI-10 keeps the message when a throw happens after the commit, and the retry returns duplicate', async () => {
    await registerAlpha();
    await injectDependency({
      change: (dependencies) => {
        dependencies.waker.notify = async () => {
          throw new Error('injected after the commit');
        };
      },
    });
    await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID }).catch(() => undefined);
    expect(await countOwnerMessages()).toBe(1);
    expect(await countReceipts()).toBe(1);
    const retried = await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    expect(retried).toMatchObject({ ok: true, value: { duplicate: true } });
    expect(await countOwnerMessages()).toBe(1);
  });

  it('WI-11 keeps the receipt across a restart of the object', async () => {
    await registerAlpha();
    await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    await evictDurableObject(accountInboxStub({ accountId: ACCOUNT_ID }));
    const retried = await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    expect(retried).toMatchObject({ ok: true, value: { duplicate: true } });
    expect(await countOwnerMessages()).toBe(1);
  });

  it('WI-12 prunes receipts past their retention on the alarm', async () => {
    await registerAlpha();
    await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    const stub = accountInboxStub({ accountId: ACCOUNT_ID });
    await advanceClock({ stub, advanceMs: RECEIPT_RETENTION_MS + 1 });
    await runDurableObjectAlarm(stub);
    expect(await countReceipts()).toBe(0);
  });

  it('WI-13 returns a stale sending claim to the queue on the alarm', async () => {
    const stub = accountInboxStub({ accountId: ACCOUNT_ID });
    await registerAlpha();
    await runInDurableObject(stub, async (instance) => {
      const { dependencies } = instance as unknown as RepositoryInternals;
      await dependencies.repository.insertMessage({
        message: buildTextMessage({ messageId: 'msg_stuck', delivery: DeliveryState.Queued, at: dependencies.clock.now() }),
      });
      await dependencies.repository.claimQueuedMessages({ claimedAt: dependencies.clock.now(), limit: 1 });
    });
    await advanceClock({ stub, advanceMs: SENDING_STALE_MS + 1 });
    await runDurableObjectAlarm(stub);
    const delivery = await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql.exec<{ delivery: string }>('SELECT delivery FROM inbox_messages WHERE id = ?', 'msg_stuck').one(),
    );
    expect(delivery.delivery).toBe(DeliveryState.Queued);
  });

  it('WI-14 picks the Cloud API sender in the development class when the access token is set', async () => {
    const sender = (await selectSender({ instanceClass: DevAccountInbox, env: testEnv })) as Record<string, unknown>;
    expect(typeof sender.session).toBe('function');
    expect(typeof sender.template).toBe('function');
    expect(sender.listScreenEntries).toBeUndefined();
  });

  it('WI-14 picks the fake sender in the development class when the access token is absent', async () => {
    const sender = (await selectSender({ instanceClass: DevAccountInbox, env: withoutAccessToken() })) as Record<string, unknown>;
    expect(typeof sender.listScreenEntries).toBe('function');
  });

  it('WI-15 refuses to build a sender in the production class when the access token is absent', async () => {
    await expect(selectSender({ instanceClass: AccountInbox, env: withoutAccessToken() })).rejects.toThrow(ACCESS_TOKEN_VARIABLE);
  });

  it('WI-15 builds the Cloud API sender in the production class when the variables are set', async () => {
    const sender = (await selectSender({ instanceClass: AccountInbox, env: testEnv })) as Record<string, unknown>;
    expect(typeof sender.session).toBe('function');
    expect(sender.listScreenEntries).toBeUndefined();
  });

  it('WI-16 keeps two accounts apart on the same channel id', async () => {
    await registerAlpha();
    await receiveText({ channelMessageId: CHANNEL_MESSAGE_ID });
    const other = accountInboxStub({ accountId: 'acc_other' });
    const outcome = await other.receiveChannelMessage({
      ownerLocale: OwnerLocale.EnglishUs,
      channelMessageId: CHANNEL_MESSAGE_ID,
      entry: ownerTextEntry({ text: 'hi', at: Date.now() }),
    });
    expect(outcome).toMatchObject({ ok: true, value: { duplicate: false } });
  });
});
