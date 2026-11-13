import { ChannelError, type AgentWaker, type InboxRepository, type MessageSender } from '@zapbip/core';
import { ChannelErrorKind, TemplateKind, WakeOutcome } from '@zapbip/types';
import { ActivityMetric } from '../contract/activity-metric';

type RecordActivity = (input: { metric: ActivityMetric }) => void;
type ActivityRecorder = { record: RecordActivity; onRecordFailure: () => void };

const TEMPLATE_METRICS: Record<TemplateKind, ActivityMetric> = {
  [TemplateKind.Notice]: ActivityMetric.TemplatesSentNotice,
  [TemplateKind.QuestionNotice]: ActivityMetric.TemplatesSentQuestion,
};
const WAKE_METRICS: Record<WakeOutcome, ActivityMetric> = {
  [WakeOutcome.Woken]: ActivityMetric.WakesWoken,
  [WakeOutcome.Unreached]: ActivityMetric.WakesUnreached,
};

function recordSafely(input: ActivityRecorder & { metric: ActivityMetric }): void {
  try {
    input.record({ metric: input.metric });
  } catch {
    input.onRecordFailure();
  }
}

function isDeliveryFailure(failure: unknown): boolean {
  return failure instanceof ChannelError && failure.code === ChannelErrorKind.DeliveryFailed;
}

export function recordSenderActivity(input: { sender: MessageSender } & ActivityRecorder): MessageSender {
  const { sender, ...recorder } = input;
  const recordFailure = (failure: unknown): never => {
    if (isDeliveryFailure(failure)) recordSafely({ ...recorder, metric: ActivityMetric.SendsFailed });
    throw failure;
  };
  return {
    session: async (request) => {
      const sent = await sender.session(request).catch(recordFailure);
      recordSafely({ ...recorder, metric: ActivityMetric.MessagesOut });
      return sent;
    },
    template: async (request) => {
      const sent = await sender.template(request).catch(recordFailure);
      recordSafely({ ...recorder, metric: TEMPLATE_METRICS[request.kind] });
      return sent;
    },
  };
}

export function recordWakerActivity(input: { waker: AgentWaker } & ActivityRecorder): AgentWaker {
  const { waker, ...recorder } = input;
  return {
    notify: async (request) => {
      const outcome = await waker.notify(request);
      recordSafely({ ...recorder, metric: WAKE_METRICS[outcome] });
      return outcome;
    },
    hasFailedWake: (request) => waker.hasFailedWake(request),
    pushesEveryMessage: (request) => waker.pushesEveryMessage(request),
  };
}

export function recordRepositoryActivity(input: { repository: InboxRepository } & ActivityRecorder): InboxRepository {
  const { repository, ...recorder } = input;
  return {
    ...repository,
    commitChannelInbound: async (commit) => {
      const isNewMessage = await repository.commitChannelInbound(commit);
      if (isNewMessage && commit.answer !== null) recordSafely({ ...recorder, metric: ActivityMetric.QuestionsAnswered });
      return isNewMessage;
    },
  };
}
