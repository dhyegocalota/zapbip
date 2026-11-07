import { ChannelErrorKind, DeliveryState, HOUR_MS, MessageKind, OwnerLocale, TemplateKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { NOTICE_RETRY_MS, OWN_NOTICE_SENDER } from '../inbox/constants';
import { buildNoticePreview } from '../inbox/inbox-copy';
import { channelError } from '../inbox/testing/channel-fixtures';
import { closeWindow, connectionOf, openWindow, receiveText } from '../inbox/testing/fixtures';
import { findNoticeRetryDueAt, retryNotice } from '../inbox/use-cases/retry-notice';
import { sendText } from '../inbox/use-cases/send-text';
import { evaluatePollers } from './evaluate-pollers';
import { staleNoticeCopy } from './wake-copy';
import { scheduledWakeOf } from './testing/wake-doubles';
import { createWakeEnvironment, type WakeEnvironment } from './testing/wake-fixtures';

const LOCALE = OwnerLocale.PortugueseBrazil;

async function schedule(input: { wakeEnvironment: WakeEnvironment; agent: string }): Promise<void> {
  const { wakeEnvironment, agent } = input;
  const { repository } = wakeEnvironment.wake;
  await repository.saveWake({ wake: scheduledWakeOf({ agent, intervalMinutes: 60, ownerLocale: LOCALE }) });
  await repository.recordPoll({ agent, polledAt: wakeEnvironment.environment.clock.now(), ownerLocale: LOCALE });
}

function goStale(input: { wakeEnvironment: WakeEnvironment }): Promise<void> {
  return input.wakeEnvironment.environment.clock.advance({ ms: 3 * HOUR_MS });
}

function staleTextOf(input: { agent: string }): string {
  return staleNoticeCopy({ locale: LOCALE, agent: input.agent, elapsedSinceLastPollMs: 3 * HOUR_MS });
}

describe('evaluatePollers in a closed window', () => {
  test('a stale notice triggers one template notice per closed window, stays queued and is delivered when the owner writes', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { environment } = wakeEnvironment;
    await schedule({ wakeEnvironment, agent: 'chatgpt' });
    await schedule({ wakeEnvironment, agent: 'hermes' });
    await goStale({ wakeEnvironment });
    await closeWindow({ environment });
    await evaluatePollers(wakeEnvironment.context);
    expect(environment.sender.templates).toEqual([
      {
        kind: TemplateKind.Notice,
        locale: LOCALE,
        parameters: [
          OWN_NOTICE_SENDER,
          buildNoticePreview({ content: { kind: MessageKind.Text, text: staleTextOf({ agent: 'chatgpt' }) }, locale: LOCALE }),
        ],
      },
    ]);
    expect(await environment.repository.listQueued()).toHaveLength(2);
    expect(environment.sender.sessions).toEqual([]);
    await receiveText({ environment, text: 'oi' });
    const sentTexts = environment.sender.sessions.map((message) => message.kind === MessageKind.Text && message.text);
    expect(sentTexts).toEqual(expect.arrayContaining([staleTextOf({ agent: 'chatgpt' }), staleTextOf({ agent: 'hermes' })]));
    expect(await environment.repository.listQueued()).toEqual([]);
  });

  test('a rejected template leaves the notice queued, marks the episode notified and the alarm retry sends the template', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { environment } = wakeEnvironment;
    await schedule({ wakeEnvironment, agent: 'chatgpt' });
    await goStale({ wakeEnvironment });
    await closeWindow({ environment });
    environment.sender.failTemplateCalls({ callNumbers: [1] });
    await evaluatePollers(wakeEnvironment.context);
    expect(wakeEnvironment.observer.events).toEqual([]);
    expect(await wakeEnvironment.wake.repository.findPollState({ agent: 'chatgpt' })).toMatchObject({ pollerStaleNotified: true });
    expect(await findNoticeRetryDueAt({ dependencies: environment.dependencies })).toBe(environment.clock.now() + NOTICE_RETRY_MS);
    await environment.clock.advance({ ms: NOTICE_RETRY_MS });
    await retryNotice({ dependencies: environment.dependencies });
    expect(environment.sender.templates).toHaveLength(2);
    expect(await environment.repository.listQueued()).toHaveLength(1);
  });

  test('a stale message left queued while the flush fails its notice for another message marks the episode notified once', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { environment } = wakeEnvironment;
    await schedule({ wakeEnvironment, agent: 'chatgpt' });
    await goStale({ wakeEnvironment });
    await closeWindow({ environment });
    await sendText({
      dependencies: environment.dependencies,
      connection: connectionOf({ agent: 'alpha' }),
      text: 'one',
      replyToMessageId: null,
    });
    await openWindow({ environment });
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.WindowClosed, errorCode: 131047 }),
    });
    environment.sender.failTemplateCalls({ callNumbers: [2] });
    await evaluatePollers(wakeEnvironment.context);
    expect(wakeEnvironment.observer.events).toEqual([]);
    expect(await wakeEnvironment.wake.repository.findPollState({ agent: 'chatgpt' })).toMatchObject({ pollerStaleNotified: true });
    const queuedTexts = (await environment.repository.listQueued()).map((message) => message.delivery);
    expect(queuedTexts).toEqual([DeliveryState.Queued, DeliveryState.Queued]);
  });
});
