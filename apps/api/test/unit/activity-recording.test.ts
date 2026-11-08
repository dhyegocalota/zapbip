import { ChannelError, type AgentWaker, type MessageSender } from '@zapbip/core';
import { AgentWakeReason, ChannelErrorKind, TemplateKind, WakeOutcome } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { recordSenderActivity, recordWakerActivity } from '../../src/account-inbox/activity-recording';
import { ActivityMetric } from '../../src/contract/activity-metric';

const AGENT = 'alpha';
const ignoreFailure = (): void => undefined;
const SENT = { channelMessageId: 'wamid.sent' };
const SESSION_REQUEST = { message: {}, question: null, replyToChannelMessageId: null, reactionTargetChannelMessageId: null } as never;
const TEMPLATE_REQUEST = { kind: TemplateKind.Notice, locale: 'pt_BR', parameters: [] } as never;

function wakerAnswering(input: { outcome: WakeOutcome }): AgentWaker {
  return { notify: async () => input.outcome, hasFailedWake: async () => false, pushesEveryMessage: async () => false };
}

function senderRejecting(input: { failure: Error }): MessageSender {
  return {
    session: async () => {
      throw input.failure;
    },
    template: async () => {
      throw input.failure;
    },
  };
}

function senderAccepting(): MessageSender {
  return { session: async () => SENT, template: async () => SENT };
}

function throwingRecord(): () => never {
  return () => {
    throw new Error('record failed');
  };
}

function channelError(input: { kind: ChannelErrorKind }): ChannelError {
  return new ChannelError({ kind: input.kind, message: 'channel', errorCode: null });
}

describe('wake activity', () => {
  it.each([
    { outcome: WakeOutcome.Woken, metric: ActivityMetric.WakesWoken },
    { outcome: WakeOutcome.Unreached, metric: ActivityMetric.WakesUnreached },
  ])('counts a notify that answered $outcome as $metric', async ({ outcome, metric }) => {
    const recorded: ActivityMetric[] = [];
    const waker = recordWakerActivity({
      waker: wakerAnswering({ outcome }),
      record: (activity) => recorded.push(activity.metric),
      onRecordFailure: ignoreFailure,
    });
    await waker.notify({ agent: AGENT, reason: AgentWakeReason.MessageWaiting });
    expect(recorded).toEqual([metric]);
  });

  it('counts nothing for a question that is not a wake attempt', async () => {
    const recorded: ActivityMetric[] = [];
    const waker = recordWakerActivity({
      waker: wakerAnswering({ outcome: WakeOutcome.Woken }),
      record: (activity) => recorded.push(activity.metric),
      onRecordFailure: ignoreFailure,
    });
    await waker.hasFailedWake({ agent: AGENT });
    await waker.pushesEveryMessage({ agent: AGENT });
    expect(recorded).toEqual([]);
  });

  it('still answers the outcome when recording throws', async () => {
    const waker = recordWakerActivity({
      waker: wakerAnswering({ outcome: WakeOutcome.Woken }),
      record: throwingRecord(),
      onRecordFailure: ignoreFailure,
    });
    expect(await waker.notify({ agent: AGENT, reason: AgentWakeReason.MessageWaiting })).toBe(WakeOutcome.Woken);
  });
});

describe('send activity', () => {
  it('reports the recording failure once by callback', async () => {
    let failures = 0;
    const sender = recordSenderActivity({ sender: senderAccepting(), record: throwingRecord(), onRecordFailure: () => (failures += 1) });
    await sender.session(SESSION_REQUEST);
    expect(failures).toBe(1);
  });

  it('still reports a delivered session send when recording throws', async () => {
    const sender = recordSenderActivity({ sender: senderAccepting(), record: throwingRecord(), onRecordFailure: ignoreFailure });
    expect(await sender.session(SESSION_REQUEST)).toEqual(SENT);
  });

  it('still reports a delivered template send when recording throws', async () => {
    const sender = recordSenderActivity({ sender: senderAccepting(), record: throwingRecord(), onRecordFailure: ignoreFailure });
    expect(await sender.template(TEMPLATE_REQUEST)).toEqual(SENT);
  });

  it('rethrows the channel error of a failed send, not the recording error', async () => {
    const failure = channelError({ kind: ChannelErrorKind.DeliveryFailed });
    const sender = recordSenderActivity({ sender: senderRejecting({ failure }), record: throwingRecord(), onRecordFailure: ignoreFailure });
    await expect(sender.session(SESSION_REQUEST)).rejects.toBe(failure);
  });

  it('counts a delivery failure of the channel as a failed send', async () => {
    const recorded: ActivityMetric[] = [];
    const sender = recordSenderActivity({
      sender: senderRejecting({ failure: channelError({ kind: ChannelErrorKind.DeliveryFailed }) }),
      record: (activity) => recorded.push(activity.metric),
      onRecordFailure: ignoreFailure,
    });
    await sender.session(SESSION_REQUEST).catch(() => undefined);
    expect(recorded).toEqual([ActivityMetric.SendsFailed]);
  });

  it.each([
    { name: 'a plain error', failure: new Error('boom') },
    { name: 'a restricted channel', failure: channelError({ kind: ChannelErrorKind.Restricted }) },
  ])('does not count $name as a failed send', async ({ failure }) => {
    const recorded: ActivityMetric[] = [];
    const sender = recordSenderActivity({
      sender: senderRejecting({ failure }),
      record: (activity) => recorded.push(activity.metric),
      onRecordFailure: ignoreFailure,
    });
    await sender.session(SESSION_REQUEST).catch(() => undefined);
    expect(recorded).toEqual([]);
  });
});
