import { ChannelErrorKind, DeliveryState, InboxErrorCode, MessageKind, TemplateKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { NOTICE_FAILED_MESSAGE, WINDOW_MS } from '../constants';
import { captureInboxError } from '../testing/capture-inbox-error';
import { closeWindow, connectionOf, createEnvironment, receiveText } from '../testing/fixtures';
import { sendText } from './send-text';

const alpha = connectionOf({ agent: 'alpha' });

function send(input: { environment: Awaited<ReturnType<typeof createEnvironment>>; text: string; replyToMessageId?: string | null }) {
  const { environment, text, replyToMessageId = null } = input;
  return sendText({ dependencies: environment.dependencies, connection: alpha, text, replyToMessageId });
}

describe('sendText', () => {
  test('CU-93 inside the window the message goes out as a session message', async () => {
    const environment = await createEnvironment();
    const result = await send({ environment, text: 'oi' });
    expect(result.delivery).toBe(DeliveryState.Sent);
    expect(environment.sender.sessions).toHaveLength(1);
    expect(environment.sender.sessions[0]).toMatchObject({ kind: MessageKind.Text, text: 'oi', agent: 'alpha' });
    expect(await environment.repository.findMessage({ messageId: result.messageId })).toMatchObject({ delivery: DeliveryState.Sent });
  });

  test('CU-94 two concurrent sends outside the window produce one notice', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    environment.sender.holdTemplates();
    const first = send({ environment, text: 'one' });
    const second = send({ environment, text: 'two' });
    await environment.clock.advance({ ms: 0 });
    expect(environment.sender.templates).toHaveLength(1);
    expect((await environment.repository.findWindow()).noticeSentForClosedWindow).toBe(true);
    environment.sender.releaseTemplates();
    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.delivery)).toEqual([DeliveryState.Queued, DeliveryState.Queued]);
    expect(environment.sender.templates).toHaveLength(1);
    expect(environment.sender.sessions).toHaveLength(0);
  });

  test('CU-95 outside the window the message queues and one notice goes out', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    const result = await send({ environment, text: 'oi' });
    expect(result.delivery).toBe(DeliveryState.Queued);
    expect(environment.sender.sessions).toHaveLength(0);
    expect(environment.sender.templates).toEqual([
      { kind: TemplateKind.Notice, locale: OwnerLocale.EnglishUs, parameters: ['alpha', 'oi'] },
    ]);
    expect(await environment.repository.findMessage({ messageId: result.messageId })).toMatchObject({ delivery: DeliveryState.Queued });
  });

  test('CU-96 a second queued message in the same closed window sends no second notice', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    await send({ environment, text: 'one' });
    await send({ environment, text: 'two' });
    expect(environment.sender.templates).toHaveLength(1);
  });

  test('CU-97 a window that closes again earns a new notice', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    await send({ environment, text: 'one' });
    await receiveText({ environment, text: 'ok' });
    await environment.clock.advance({ ms: WINDOW_MS });
    await send({ environment, text: 'two' });
    await send({ environment, text: 'three' });
    expect(environment.sender.templates).toHaveLength(1);
  });

  test('CU-98 the notice preview has no newline and at most 60 characters', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    await send({ environment, text: `first line\n${'x'.repeat(100)}` });
    const [, preview] = environment.sender.templates[0]!.parameters;
    expect(preview).not.toContain('\n');
    expect([...preview!].length).toBeLessThanOrEqual(60);
  });

  test('CU-99 a failed send is stored as failed and never reported as sent', async () => {
    const environment = await createEnvironment();
    environment.sender.failSessionCalls({ callNumbers: [1] });
    const error = await captureInboxError(() => send({ environment, text: 'oi' }));
    expect(error).toEqual({ code: ChannelErrorKind.DeliveryFailed, message: 'delivery failed for text' });
    const history = await environment.repository.listAgentHistory({ agent: 'alpha', limit: 5 });
    expect(history.map((message) => message.delivery)).toEqual([DeliveryState.Failed]);
  });

  test('a failed notice raises a delivery failure naming the notice, keeps the message queued and releases the claim', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    environment.sender.failTemplateCalls({ callNumbers: [1] });
    const error = await captureInboxError(() => send({ environment, text: 'one' }));
    expect(error).toEqual({ code: ChannelErrorKind.DeliveryFailed, message: NOTICE_FAILED_MESSAGE });
    const history = await environment.repository.listAgentHistory({ agent: 'alpha', limit: 5 });
    expect(history.map((message) => message.delivery)).toEqual([DeliveryState.Queued]);
    expect(await environment.repository.findWindow()).toMatchObject({
      noticeSentForClosedWindow: false,
      noticeRetryLocale: OwnerLocale.EnglishUs,
    });
    const second = await send({ environment, text: 'two' });
    expect(second.delivery).toBe(DeliveryState.Queued);
    expect(environment.sender.templates).toHaveLength(1);
  });

  test('CU-94b concurrent sends with the notice failing once fail only the claim owner and keep both queued', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    environment.sender.holdTemplates();
    environment.sender.failTemplateCalls({ callNumbers: [1] });
    const first = captureInboxError(() => send({ environment, text: 'one' }));
    const second = send({ environment, text: 'two' });
    await environment.clock.advance({ ms: 0 });
    environment.sender.releaseTemplates();
    const [error, loser] = await Promise.all([first, second]);
    expect(error).toEqual({ code: ChannelErrorKind.DeliveryFailed, message: NOTICE_FAILED_MESSAGE });
    expect(loser.delivery).toBe(DeliveryState.Queued);
    expect(environment.sender.templates).toHaveLength(1);
    await send({ environment, text: 'three' });
    expect(environment.sender.templates).toHaveLength(1);
    const history = await environment.repository.listAgentHistory({ agent: 'alpha', limit: 5 });
    expect(history.map((message) => message.delivery)).toEqual([DeliveryState.Queued, DeliveryState.Queued, DeliveryState.Queued]);
  });

  test('CU-100 a reply to an unknown message is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => send({ environment, text: 'oi', replyToMessageId: 'msg_missing' }));
    expect(error).toEqual({ code: InboxErrorCode.NotFound, message: 'reply_to: message not found' });
  });

  test('a reply to a known message keeps the link', async () => {
    const environment = await createEnvironment();
    const first = await send({ environment, text: 'one' });
    const second = await send({ environment, text: 'two', replyToMessageId: first.messageId });
    expect(await environment.repository.findMessage({ messageId: second.messageId })).toMatchObject({ replyToMessageId: first.messageId });
  });

  test('text over the limit is rejected before anything is stored', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => send({ environment, text: 'a'.repeat(4097) }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'text: must be at most 4096 characters' });
    expect(await environment.repository.listAgentHistory({ agent: 'alpha', limit: 5 })).toEqual([]);
  });

  test('a send registers the agent', async () => {
    const environment = await createEnvironment();
    await send({ environment, text: 'oi' });
    expect((await environment.repository.listAgents()).map((record) => record.agent)).toEqual(['alpha']);
  });
});
