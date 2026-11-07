import type { AgentWaker, MessageSender } from '@zapbip/core';
import { TemplateKind, WakeOutcome } from '@zapbip/types';
import { ActivityMetric } from '../contract/activity-metric';

type RecordActivity = (input: { metric: ActivityMetric }) => void;

const TEMPLATE_METRICS: Record<TemplateKind, ActivityMetric> = {
  [TemplateKind.Notice]: ActivityMetric.TemplatesSentNotice,
  [TemplateKind.QuestionNotice]: ActivityMetric.TemplatesSentQuestion,
};
const WAKE_METRICS: Record<WakeOutcome, ActivityMetric> = {
  [WakeOutcome.Woken]: ActivityMetric.WakesWoken,
  [WakeOutcome.Unreached]: ActivityMetric.WakesUnreached,
};

export function recordSenderActivity(input: { sender: MessageSender; record: RecordActivity }): MessageSender {
  const { sender, record } = input;
  const recordFailure = (failure: unknown): never => {
    record({ metric: ActivityMetric.SendsFailed });
    throw failure;
  };
  return {
    session: async (request) => {
      const sent = await sender.session(request).catch(recordFailure);
      record({ metric: ActivityMetric.MessagesOut });
      return sent;
    },
    template: async (request) => {
      const sent = await sender.template(request).catch(recordFailure);
      record({ metric: TEMPLATE_METRICS[request.kind] });
      return sent;
    },
  };
}

export function recordWakerActivity(input: { waker: AgentWaker; record: RecordActivity }): AgentWaker {
  const { waker, record } = input;
  return {
    notify: async (request) => {
      const outcome = await waker.notify(request);
      record({ metric: WAKE_METRICS[outcome] });
      return outcome;
    },
    hasFailedWake: (request) => waker.hasFailedWake(request),
    pushesEveryMessage: (request) => waker.pushesEveryMessage(request),
  };
}
