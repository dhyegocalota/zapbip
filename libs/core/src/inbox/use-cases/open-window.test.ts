import { ChannelErrorKind, DeliveryState, OwnerLocale, TemplateKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { FLUSH_CLAIM_LIMIT, QUEUE_RETENTION_MS } from '../constants';
import { channelError, insertQueued } from '../testing/channel-fixtures';
import { closeWindow as closeWindowFixture, createEnvironment } from '../testing/fixtures';
import { isOwnerWindowOpen } from '../window';
import { closeWindow } from './close-window';
import { openWindow } from './open-window';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function open(input: { environment: Environment; at?: number; ownerLocale?: OwnerLocale }) {
  const { environment, at = environment.clock.now(), ownerLocale = OwnerLocale.EnglishUs } = input;
  return openWindow({ dependencies: environment.dependencies, ownerLocale, at });
}

async function deliveryOf(input: { environment: Environment; messageId: string }): Promise<DeliveryState | null> {
  const message = await input.environment.repository.findMessage({ messageId: input.messageId });
  if (message === null) throw new Error('expected the message to exist');
  return message.delivery;
}

describe('openWindow', () => {
  test('CU-24 opens the window and sends the queue in order', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const queued = await insertQueued({ environment, texts: ['one', 'two', 'three'] });
    await open({ environment });
    expect(environment.sender.sessions).toMatchObject([{ text: 'one' }, { text: 'two' }, { text: 'three' }]);
    expect(await Promise.all(queued.map((message) => deliveryOf({ environment, messageId: message.messageId })))).toEqual([
      DeliveryState.Sent,
      DeliveryState.Sent,
      DeliveryState.Sent,
    ]);
    expect(await environment.repository.findWindow()).toEqual({
      lastOwnerMessageAt: environment.clock.now(),
      noticeSentForClosedWindow: false,
      closedAt: null,
    });
  });

  test('each sent message keeps the channel id the sender returned', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const [queued] = await insertQueued({ environment, texts: ['one'] });
    await open({ environment });
    expect(await environment.repository.findChannelMessageId({ messageId: queued!.messageId })).toBe('wamid.session.1');
  });

  test('CU-24a one message that fails does not stop the others', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const queued = await insertQueued({ environment, texts: ['one', 'two', 'three'] });
    environment.sender.failSessionCalls({
      callNumbers: [2],
      error: channelError({ kind: ChannelErrorKind.RateLimited, errorCode: 130429 }),
    });
    await open({ environment });
    expect(await Promise.all(queued.map((message) => deliveryOf({ environment, messageId: message.messageId })))).toEqual([
      DeliveryState.Sent,
      DeliveryState.Failed,
      DeliveryState.Sent,
    ]);
    expect(environment.repository.findStatusDetail({ messageId: queued[1]!.messageId })).toMatchObject({ errorCode: 130429 });
  });

  test('a sender error that is not a channel error also fails only its message', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const queued = await insertQueued({ environment, texts: ['one', 'two'] });
    environment.sender.failSessionCalls({ callNumbers: [1] });
    await open({ environment });
    expect(await Promise.all(queued.map((message) => deliveryOf({ environment, messageId: message.messageId })))).toEqual([
      DeliveryState.Failed,
      DeliveryState.Sent,
    ]);
    expect(environment.repository.findStatusDetail({ messageId: queued[0]!.messageId })).toBeNull();
  });

  test('CU-24b a closed window stops the flush, keeps the rest queued and sends one notice', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const queued = await insertQueued({ environment, texts: ['one', 'two', 'three'] });
    environment.sender.failSessionCalls({
      callNumbers: [2],
      error: channelError({ kind: ChannelErrorKind.WindowClosed, errorCode: 131047 }),
    });
    await open({ environment });
    expect(await Promise.all(queued.map((message) => deliveryOf({ environment, messageId: message.messageId })))).toEqual([
      DeliveryState.Sent,
      DeliveryState.Queued,
      DeliveryState.Queued,
    ]);
    expect(environment.sender.sessionRequests).toHaveLength(2);
    const window = await environment.repository.findWindow();
    expect(window.closedAt).toBe(environment.clock.now());
    expect(isOwnerWindowOpen({ window, now: environment.clock.now() })).toBe(false);
    expect(environment.sender.templates).toEqual([
      { kind: TemplateKind.Notice, locale: OwnerLocale.EnglishUs, parameters: ['alpha', 'two'] },
    ]);
  });

  test('a notice that fails is released and the messages stay queued', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const queued = await insertQueued({ environment, texts: ['one'] });
    environment.sender.failSessionCalls({ callNumbers: [1], error: channelError({ kind: ChannelErrorKind.WindowClosed }) });
    environment.sender.failTemplateCalls({ callNumbers: [1] });
    await open({ environment });
    expect(await deliveryOf({ environment, messageId: queued[0]!.messageId })).toBe(DeliveryState.Queued);
    expect((await environment.repository.findWindow()).noticeSentForClosedWindow).toBe(false);
  });

  test('CU-24c two concurrent flushes send each queued message once', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    await insertQueued({ environment, texts: ['one', 'two', 'three'] });
    environment.sender.holdSessions();
    const flushes = Promise.all([open({ environment }), open({ environment })]);
    await environment.clock.advance({ ms: 0 });
    environment.sender.releaseSessions();
    await flushes;
    expect(environment.sender.sessionRequests).toHaveLength(3);
    expect(environment.sender.sessions.map((message) => (message.kind === 'text' ? message.text : null))).toEqual(['one', 'two', 'three']);
  });

  test('a queue longer than one claim is flushed to the end', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const texts = Array.from({ length: FLUSH_CLAIM_LIMIT + 3 }, (_unused, index) => `m${index}`);
    await insertQueued({ environment, texts });
    await open({ environment });
    expect(environment.sender.sessionRequests).toHaveLength(texts.length);
    expect(await environment.repository.listQueued()).toEqual([]);
  });

  test('CU-24d a queued message past its retention is expired, not sent', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    const queued = await insertQueued({ environment, texts: ['old'] });
    await environment.clock.advance({ ms: QUEUE_RETENTION_MS });
    await open({ environment });
    expect(await deliveryOf({ environment, messageId: queued[0]!.messageId })).toBe(DeliveryState.Expired);
    expect(environment.sender.sessionRequests).toEqual([]);
  });

  test('CU-15 an owner message after a reported closing reopens the window', async () => {
    const environment = await createEnvironment();
    const closedAt = environment.clock.now() + 1;
    await closeWindow({ dependencies: environment.dependencies, at: closedAt });
    await environment.clock.advance({ ms: 5 });
    await open({ environment });
    const window = await environment.repository.findWindow();
    expect(isOwnerWindowOpen({ window, now: environment.clock.now() + 1 })).toBe(true);
  });

  test('CU-41 an older timestamp never moves the window back', async () => {
    const environment = await createEnvironment();
    const newer = environment.clock.now() + 10;
    await open({ environment, at: newer });
    await open({ environment, at: environment.clock.now() + 5 });
    expect((await environment.repository.findWindow()).lastOwnerMessageAt).toBe(newer);
  });

  test('the first owner message of a never-opened window sets it', async () => {
    const environment = await createEnvironment();
    await environment.repository.saveWindow({ window: { lastOwnerMessageAt: null, noticeSentForClosedWindow: false, closedAt: null } });
    await open({ environment, at: 123 });
    expect((await environment.repository.findWindow()).lastOwnerMessageAt).toBe(123);
  });
});
