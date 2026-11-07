import { DeliveryState, IdPrefix, MessageKind, OwnerLocale, TemplateKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { NOTICE_FAILED_MESSAGE, NOTICE_RETRY_BACKOFF_FACTOR, NOTICE_RETRY_MAX_MS, NOTICE_RETRY_MS } from '../constants';
import { captureInboxError } from '../testing/capture-inbox-error';
import { closeWindow, connectionOf, createEnvironment, openWindow } from '../testing/fixtures';
import type { InMemoryEnvironment } from '../testing/in-memory';
import { deliverToOwner } from './deliver-to-owner';
import { findNoticeRetryDueAt, retryNotice } from './retry-notice';
import { sendText } from './send-text';

const alpha = connectionOf({ agent: 'alpha', ownerLocale: OwnerLocale.PortugueseBrazil });

async function sendWithFailingNotice(input: { environment: InMemoryEnvironment; failingCalls: number[] }) {
  const { environment, failingCalls } = input;
  await closeWindow({ environment });
  environment.sender.failTemplateCalls({ callNumbers: failingCalls });
  await captureInboxError(() =>
    sendText({ dependencies: environment.dependencies, connection: alpha, text: 'oi', replyToMessageId: null }),
  );
}

describe('retryNotice', () => {
  test('CU-94c with no failed notice nothing is due and nothing is sent', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBeNull();
    await retryNotice({ dependencies: environment.dependencies });
    expect(environment.sender.templates).toHaveLength(0);
  });

  test('CU-94d a failed notice is due one interval later and the retry sends it in the owner locale', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1] });
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBe(environment.clock.now() + NOTICE_RETRY_MS);
    await environment.clock.advance({ ms: NOTICE_RETRY_MS });
    await retryNotice({ dependencies: environment.dependencies });
    expect(environment.sender.templates).toHaveLength(2);
    expect(environment.sender.templates[1]).toEqual({
      kind: TemplateKind.Notice,
      locale: OwnerLocale.PortugueseBrazil,
      parameters: ['alpha', 'oi'],
    });
    expect((await environment.repository.findWindow()).noticeSentForClosedWindow).toBe(true);
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBeNull();
  });

  test('CU-94e a persistent failure doubles the spacing of each attempt', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1, 2, 3, 4] });
    const spacings = [1, 2, 3].map((attempt) => NOTICE_RETRY_MS * NOTICE_RETRY_BACKOFF_FACTOR ** (attempt - 1));
    await spacings.reduce(async (previous, spacing) => {
      await previous;
      expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBe(environment.clock.now() + spacing);
      await environment.clock.advance({ ms: spacing });
      const error = await captureInboxError(() => retryNotice({ dependencies: environment.dependencies }));
      expect(error.message).toBe(NOTICE_FAILED_MESSAGE);
    }, Promise.resolve());
    expect(environment.sender.templates).toHaveLength(1 + spacings.length);
    const history = await environment.repository.listAgentHistory({ agent: 'alpha', limit: 5 });
    expect(history.map((message) => message.delivery)).toEqual([DeliveryState.Queued]);
  });

  test('CU-94h the spacing never grows past the cap', async () => {
    const environment = await createEnvironment();
    const attempts = Array.from({ length: 12 }, (_unused, index) => index + 1);
    await sendWithFailingNotice({ environment, failingCalls: [0, ...attempts].map((attempt) => attempt + 1) });
    await attempts.reduce(async (previous) => {
      await previous;
      const dueAt = await findNoticeRetryDueAt({ dependencies: environment.dependencies });
      if (dueAt === null) throw new Error('expected a retry due time');
      await environment.clock.advance({ ms: dueAt - environment.clock.now() });
      await captureInboxError(() => retryNotice({ dependencies: environment.dependencies }));
    }, Promise.resolve());
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBe(environment.clock.now() + NOTICE_RETRY_MAX_MS);
  });

  test('CU-94i a retry before the due time sends nothing and keeps the due time', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1] });
    const dueAt = await findNoticeRetryDueAt({ dependencies: environment.dependencies });
    await environment.clock.advance({ ms: NOTICE_RETRY_MS - 1 });
    await retryNotice({ dependencies: environment.dependencies });
    expect(environment.sender.templates).toHaveLength(1);
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBe(dueAt);
  });

  test('CU-94j a successful retry resets the attempts and the due time', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1, 2] });
    await environment.clock.advance({ ms: NOTICE_RETRY_MS });
    await captureInboxError(() => retryNotice({ dependencies: environment.dependencies }));
    await environment.clock.advance({ ms: NOTICE_RETRY_MS * NOTICE_RETRY_BACKOFF_FACTOR });
    await retryNotice({ dependencies: environment.dependencies });
    expect(await environment.repository.findWindow()).toMatchObject({
      noticeSentForClosedWindow: true,
      noticeRetryLocale: null,
      noticeRetryAt: null,
      noticeRetryAttempt: 0,
    });
  });

  test('CU-94f the owner opening the window cancels the retry', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1] });
    await openWindow({ environment });
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBeNull();
    await retryNotice({ dependencies: environment.dependencies });
    expect(environment.sender.templates).toHaveLength(1);
  });

  test('a zapbip note queued ahead of an agent message: the retry names the agent and previews its message', async () => {
    const environment = await createEnvironment();
    const { dependencies } = environment;
    await closeWindow({ environment });
    environment.sender.failTemplateCalls({ callNumbers: [1] });
    await captureInboxError(() =>
      deliverToOwner({
        dependencies,
        ownerLocale: OwnerLocale.PortugueseBrazil,
        agent: null,
        messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
        content: { kind: MessageKind.Text, text: 'note from zapbip' },
        replyToMessageId: null,
      }),
    );
    await sendText({ dependencies, connection: alpha, text: 'oi', replyToMessageId: null });
    await environment.clock.advance({ ms: NOTICE_RETRY_MS });
    await retryNotice({ dependencies });
    expect(environment.sender.templates.at(-1)).toEqual({
      kind: TemplateKind.Notice,
      locale: OwnerLocale.PortugueseBrazil,
      parameters: ['alpha', 'oi'],
    });
  });

  test('CU-94g a queued message that expired leaves nothing to retry', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1] });
    const [queued] = await environment.repository.listQueued();
    if (queued === undefined) throw new Error('expected a queued message');
    await environment.repository.updateDelivery({ messageId: queued.messageId, delivery: DeliveryState.Expired });
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBeNull();
  });
});
