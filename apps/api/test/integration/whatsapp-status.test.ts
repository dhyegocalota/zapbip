import { TEST_META_APP_SECRET } from '../support/meta-app-secret';
import { runInDurableObject, SELF } from 'cloudflare:test';
import { HISTORY_LIMIT, type CoreDependencies } from '@zapbip/core';
import { DeliveryState, HttpStatus, MINUTE_MS } from '@zapbip/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { D1MessageIndex } from '../../src/adapters/d1/d1-message-index';
import { UNINDEXED_STATUS_RETRY_WINDOW_MS, WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import deliveredFixture from '../fixtures/whatsapp/status/delivered.json';
import failedFixture from '../fixtures/whatsapp/status/failed.json';
import playedFixture from '../fixtures/whatsapp/status/played.json';
import readFixture from '../fixtures/whatsapp/status/read.json';
import { notificationWith } from '../fixtures/whatsapp/inbound/notification';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { buildTextMessage } from '../support/builders';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { inboxOf, ORIGIN, seedAccount, type SeededAccount } from './route-fixtures';

const STATUS_OK = 200;
const MILLISECONDS_PER_SECOND = 1_000;
const STALE_MARGIN_MS = MINUTE_MS;
const OUTBOUND_MESSAGE_ID = 'msg_out_1';
const FAILURE_CODE = 131_026;
const FAILURE_TITLE = 'Message undeliverable';

type StatusDetailRow = { error_code: number | null; error_title: string | null; pricing_category: string | null; billable: number | null };

afterEach(() => {
  vi.restoreAllMocks();
});

async function postStatus(input: { status: object }): Promise<Response> {
  const text = JSON.stringify(notificationWith({ statuses: [input.status] }));
  const signature = await signatureHeaderOf({ appSecret: TEST_META_APP_SECRET, body: new TextEncoder().encode(text) });
  return SELF.fetch(`${ORIGIN}${WHATSAPP_WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { [WEBHOOK_SIGNATURE_HEADER]: signature },
    body: text,
  });
}

function secondsAgo(input: { ageMs: number }): string {
  return String(Math.floor((Date.now() - input.ageMs) / MILLISECONDS_PER_SECOND));
}

async function seedSentMessage(input: { account: SeededAccount; channelMessageId: string }): Promise<void> {
  const { account, channelMessageId } = input;
  await runInDurableObject(accountInboxStub({ accountId: account.accountId }), async (instance) => {
    const { repository } = (instance as unknown as { dependencies: CoreDependencies }).dependencies;
    await repository.insertMessage({
      message: buildTextMessage({ messageId: OUTBOUND_MESSAGE_ID, agent: 'alpha', delivery: DeliveryState.Sent }),
    });
    await repository.saveChannelMessageId({ messageId: OUTBOUND_MESSAGE_ID, channelMessageId });
  });
  await new D1MessageIndex({ database: testEnv.CONNECTIONS }).record({
    id: channelMessageId,
    accountId: account.accountId,
    at: Date.now(),
  });
}

async function deliveryOf(input: { account: SeededAccount }): Promise<DeliveryState | null> {
  const outcome = await inboxOf({ accountId: input.account.accountId }).getMessages({
    connection: input.account.connection,
    limit: HISTORY_LIMIT,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  const [message] = outcome.value.history;
  if (message === undefined) throw new Error('the history is empty');
  return message.delivery;
}

function detailOf(input: { account: SeededAccount }): Promise<StatusDetailRow> {
  return runInDurableObject(accountInboxStub({ accountId: input.account.accountId }), (_instance, state) =>
    state.storage.sql
      .exec<StatusDetailRow>(
        'SELECT error_code, error_title, pricing_category, billable FROM inbox_messages WHERE id = ?',
        OUTBOUND_MESSAGE_ID,
      )
      .one(),
  );
}

async function sentBy(input: { channelMessageId: string }): Promise<SeededAccount> {
  const account = await seedAccount({ agent: 'alpha' });
  await seedSentMessage({ account, channelMessageId: input.channelMessageId });
  return account;
}

function statusOf(input: { fixture: object; channelMessageId: string }): object {
  return { ...input.fixture, id: input.channelMessageId, timestamp: secondsAgo({ ageMs: 0 }) };
}

async function indexOnly(input: { account: SeededAccount; channelMessageId: string }): Promise<void> {
  await new D1MessageIndex({ database: testEnv.CONNECTIONS }).record({
    id: input.channelMessageId,
    accountId: input.account.accountId,
    at: Date.now(),
  });
}

describe('webhook statuses', () => {
  test('R6 answers 503 for a young status whose message the account has not saved yet, so Meta retries', async () => {
    const channelMessageId = 'wamid.R6YOUNG';
    const account = await seedAccount({ agent: 'alpha' });
    await indexOnly({ account, channelMessageId });
    const response = await postStatus({ status: statusOf({ fixture: readFixture, channelMessageId }) });
    expect(response.status).toBe(HttpStatus.ServiceUnavailable);
  });

  test('R6 answers 200 and logs status.unindexed for an old status whose message the account never saved', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const channelMessageId = 'wamid.R6OLD';
    const account = await seedAccount({ agent: 'alpha' });
    await indexOnly({ account, channelMessageId });
    const ageMs = UNINDEXED_STATUS_RETRY_WINDOW_MS + STALE_MARGIN_MS;
    const response = await postStatus({ status: { ...readFixture, id: channelMessageId, timestamp: secondsAgo({ ageMs }) } });
    expect(response.status).toBe(STATUS_OK);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.StatusUnindexed);
  });

  test('WI-50 answers 503 for an unindexed wamid that is young, so Meta retries', async () => {
    const response = await postStatus({ status: { ...readFixture, id: 'wamid.YOUNG', timestamp: secondsAgo({ ageMs: 0 }) } });
    expect(response.status).toBe(HttpStatus.ServiceUnavailable);
  });

  test('WI-51 answers 200 and logs status.unindexed once the status is older than the window', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const ageMs = UNINDEXED_STATUS_RETRY_WINDOW_MS + STALE_MARGIN_MS;
    const response = await postStatus({ status: { ...readFixture, id: 'wamid.OLD', timestamp: secondsAgo({ ageMs }) } });
    expect(response.status).toBe(STATUS_OK);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.StatusUnindexed);
  });

  test('WI-56 answers 200 and logs status.ignored for a played status', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const response = await postStatus({ status: { ...playedFixture, timestamp: secondsAgo({ ageMs: 0 }) } });
    expect(response.status).toBe(STATUS_OK);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.StatusIgnored);
  });

  test('WI-52 marks a sent message read', async () => {
    const channelMessageId = 'wamid.WI52';
    const account = await sentBy({ channelMessageId });
    const response = await postStatus({ status: statusOf({ fixture: readFixture, channelMessageId }) });
    expect(response.status).toBe(STATUS_OK);
    expect(await deliveryOf({ account })).toBe(DeliveryState.Read);
  });

  test('WI-53 keeps read when a late delivered arrives', async () => {
    const channelMessageId = 'wamid.WI53';
    const account = await sentBy({ channelMessageId });
    const statuses = [deliveredFixture, readFixture, deliveredFixture].map((fixture) => statusOf({ fixture, channelMessageId }));
    const responses = await statuses.reduce<Promise<Response[]>>(
      async (done, status) => [...(await done), await postStatus({ status })],
      Promise.resolve([]),
    );
    expect(responses.map((response) => response.status)).toEqual([STATUS_OK, STATUS_OK, STATUS_OK]);
    expect(await deliveryOf({ account })).toBe(DeliveryState.Read);
  });

  test('WI-54 ignores a failed that arrives after read and logs status.failed.ignored', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const channelMessageId = 'wamid.WI54';
    const account = await sentBy({ channelMessageId });
    await postStatus({ status: statusOf({ fixture: readFixture, channelMessageId }) });
    const response = await postStatus({ status: statusOf({ fixture: failedFixture, channelMessageId }) });
    expect(response.status).toBe(STATUS_OK);
    expect(await deliveryOf({ account })).toBe(DeliveryState.Read);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.StatusFailedIgnored);
  });

  test('WI-55 marks a sent message failed and stores the error code and title', async () => {
    const channelMessageId = 'wamid.WI55';
    const account = await sentBy({ channelMessageId });
    const response = await postStatus({ status: statusOf({ fixture: failedFixture, channelMessageId }) });
    expect(response.status).toBe(STATUS_OK);
    expect(await deliveryOf({ account })).toBe(DeliveryState.Failed);
    expect(await detailOf({ account })).toMatchObject({ error_code: FAILURE_CODE, error_title: FAILURE_TITLE });
  });

  test('WI-57 stores the pricing of a delivered status and keeps it through a later read without pricing', async () => {
    const channelMessageId = 'wamid.WI57';
    const account = await sentBy({ channelMessageId });
    await postStatus({ status: statusOf({ fixture: deliveredFixture, channelMessageId }) });
    expect(await detailOf({ account })).toMatchObject({ pricing_category: 'service', billable: 0 });
    await postStatus({ status: statusOf({ fixture: readFixture, channelMessageId }) });
    expect(await detailOf({ account })).toMatchObject({ pricing_category: 'service', billable: 0 });
  });
});
