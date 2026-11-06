import { DeliveryState, OwnerLocale, TemplateKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { NOTICE_RETRY_MS } from '../constants';
import { captureInboxError } from '../testing/capture-inbox-error';
import { closeWindow, connectionOf, createEnvironment, openWindow } from '../testing/fixtures';
import type { InMemoryEnvironment } from '../testing/in-memory';
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

  test('CU-94e a persistent failure makes one attempt and one new due time per interval', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1, 2, 3, 4] });
    const attempts = [1, 2, 3];
    await attempts.reduce(async (previous) => {
      await previous;
      await environment.clock.advance({ ms: NOTICE_RETRY_MS });
      const error = await captureInboxError(() => retryNotice({ dependencies: environment.dependencies }));
      expect(error.message).toBe('delivery failed for notice');
      expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBe(environment.clock.now() + NOTICE_RETRY_MS);
    }, Promise.resolve());
    expect(environment.sender.templates).toHaveLength(1 + attempts.length);
    const history = await environment.repository.listAgentHistory({ agent: 'alpha', limit: 5 });
    expect(history.map((message) => message.delivery)).toEqual([DeliveryState.Queued]);
  });

  test('CU-94f the owner opening the window cancels the retry', async () => {
    const environment = await createEnvironment();
    await sendWithFailingNotice({ environment, failingCalls: [1] });
    await openWindow({ environment });
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBeNull();
    await retryNotice({ dependencies: environment.dependencies });
    expect(environment.sender.templates).toHaveLength(1);
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
