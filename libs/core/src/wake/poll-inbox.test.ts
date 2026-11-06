import { InboxStatus, MINUTE_MS, OwnerLocale, SECOND_MS } from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { ask } from '../inbox/use-cases/ask';
import { waitForReply } from '../inbox/use-cases/wait-for-reply';
import { getMessages } from '../inbox/use-cases/get-messages';
import { connectionOf, receiveText, registerAgents } from '../inbox/testing/fixtures';
import { pollInbox } from './poll-inbox';
import { createWakeEnvironment, type WakeEnvironment } from './testing/wake-fixtures';

const AGENT = 'chatgpt';

function poll(input: { wakeEnvironment: WakeEnvironment }) {
  return pollInbox({
    ...input.wakeEnvironment.context,
    connection: connectionOf({ agent: AGENT, ownerLocale: OwnerLocale.PortugueseBrazil }),
  });
}

describe('pollInbox', () => {
  test('an empty box records the poll and reads no body', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { repository } = wakeEnvironment.environment;
    const recordPoll = vi.spyOn(wakeEnvironment.wake.repository, 'recordPoll');
    const countUnread = vi.spyOn(repository, 'countUnread');
    const listUnread = vi.spyOn(repository, 'listUnread');
    const markRead = vi.spyOn(repository, 'markRead');
    expect(await poll({ wakeEnvironment })).toEqual({ status: InboxStatus.Empty, messages: [] });
    expect(recordPoll).toHaveBeenCalledOnce();
    expect(recordPoll).toHaveBeenCalledWith({
      agent: AGENT,
      polledAt: wakeEnvironment.environment.clock.now(),
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
    expect(countUnread).toHaveBeenCalledOnce();
    expect(listUnread).not.toHaveBeenCalled();
    expect(markRead).not.toHaveBeenCalled();
  });

  test('registers the agent before it records the poll', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const registerAgent = vi.spyOn(wakeEnvironment.environment.repository, 'registerAgent');
    const recordPoll = vi.spyOn(wakeEnvironment.wake.repository, 'recordPoll');
    await poll({ wakeEnvironment });
    expect(registerAgent.mock.invocationCallOrder[0]).toBeLessThan(recordPoll.mock.invocationCallOrder[0] as number);
  });

  test('two unread messages come back once and are marked read', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await registerAgents({ environment: wakeEnvironment.environment, agents: [AGENT] });
    await receiveText({ environment: wakeEnvironment.environment, text: `@${AGENT} one` });
    await receiveText({ environment: wakeEnvironment.environment, text: `@${AGENT} two` });
    const result = await poll({ wakeEnvironment });
    expect(result.status).toBe(InboxStatus.New);
    expect(result.messages).toHaveLength(2);
    expect(await wakeEnvironment.environment.repository.countUnread({ agent: AGENT })).toBe(0);
  });

  test('a poll clears the stale flag and marks the connection as polled', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { repository } = wakeEnvironment.wake;
    await repository.recordPoll({ agent: AGENT, polledAt: 0, ownerLocale: OwnerLocale.PortugueseBrazil });
    await repository.markStaleNotified({ agent: AGENT });
    await wakeEnvironment.environment.clock.advance({ ms: MINUTE_MS });
    await poll({ wakeEnvironment });
    expect(await repository.findPollState({ agent: AGENT })).toEqual({
      lastPolledAt: wakeEnvironment.environment.clock.now(),
      hasPolled: true,
      pollerStaleNotified: false,
    });
  });

  test('getMessages records no poll', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const recordPoll = vi.spyOn(wakeEnvironment.wake.repository, 'recordPoll');
    await getMessages({ ...wakeEnvironment.context, connection: connectionOf({ agent: AGENT }), limit: 5 });
    expect(recordPoll).not.toHaveBeenCalled();
  });

  test('pin: ask records no poll', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const recordPoll = vi.spyOn(wakeEnvironment.wake.repository, 'recordPoll');
    const asking = ask({
      ...wakeEnvironment.context,
      connection: connectionOf({ agent: AGENT }),
      text: 'Deploy?',
      options: ['Sim', 'Não'],
      optionDescriptions: [],
      timeoutMs: SECOND_MS,
    });
    await wakeEnvironment.environment.clock.advance({ ms: SECOND_MS });
    await asking;
    expect(recordPoll).not.toHaveBeenCalled();
  });

  test('pin: waitForReply records no poll', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const recordPoll = vi.spyOn(wakeEnvironment.wake.repository, 'recordPoll');
    const waiting = waitForReply({
      ...wakeEnvironment.context,
      connection: connectionOf({ agent: AGENT }),
      questionId: null,
      timeoutMs: SECOND_MS,
    });
    await wakeEnvironment.environment.clock.advance({ ms: SECOND_MS });
    await waiting;
    expect(recordPoll).not.toHaveBeenCalled();
  });
});
