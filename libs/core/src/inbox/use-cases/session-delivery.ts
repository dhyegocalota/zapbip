import { ChannelErrorKind, DeliveryState, MessageKind } from '@zapbip/types';
import { ChannelError, InboxError } from '../errors';
import type { Message } from '../message';
import type { CoreDependencies, InboxRepository } from '../ports';

export enum SessionOutcome {
  Sent = 'sent',
  WindowClosed = 'window_closed',
  Failed = 'failed',
}

export type SessionAttempt =
  | { outcome: SessionOutcome.Sent; channelMessageId: string }
  | { outcome: SessionOutcome.WindowClosed }
  | { outcome: SessionOutcome.Failed; error: unknown };

const REACTION_TARGET_FIELD = 'reaction.message_id';

function findChannelId(input: { repository: InboxRepository; messageId: string | null }): Promise<string | null> {
  if (input.messageId === null) return Promise.resolve(null);
  return input.repository.findChannelMessageId({ messageId: input.messageId });
}

async function sendSessionMessage(input: { dependencies: CoreDependencies; message: Message }): Promise<{ channelMessageId: string }> {
  const { repository, sender } = input.dependencies;
  const { message } = input;
  const reactionTargetMessageId = message.kind === MessageKind.Reaction ? message.targetMessageId : null;
  const [replyToChannelMessageId, reactionTargetChannelMessageId, question] = await Promise.all([
    findChannelId({ repository, messageId: message.replyToMessageId }),
    findChannelId({ repository, messageId: reactionTargetMessageId }),
    message.kind === MessageKind.Choice ? repository.findQuestion({ questionId: message.questionId }) : null,
  ]);
  if (message.kind === MessageKind.Reaction && reactionTargetChannelMessageId === null)
    throw new ChannelError({
      kind: ChannelErrorKind.ReactionRejected,
      message: `Reaction target invalid: ${REACTION_TARGET_FIELD}`,
      errorCode: null,
    });
  return sender.session({ message, question, replyToChannelMessageId, reactionTargetChannelMessageId });
}

export async function attemptSession(input: { dependencies: CoreDependencies; message: Message }): Promise<SessionAttempt> {
  try {
    const { channelMessageId } = await sendSessionMessage(input);
    return { outcome: SessionOutcome.Sent, channelMessageId };
  } catch (error) {
    const isWindowClosed = error instanceof ChannelError && error.code === ChannelErrorKind.WindowClosed;
    if (isWindowClosed) return { outcome: SessionOutcome.WindowClosed };
    return { outcome: SessionOutcome.Failed, error };
  }
}

export async function recordSent(input: { dependencies: CoreDependencies; messageId: string; channelMessageId: string }): Promise<void> {
  const { repository } = input.dependencies;
  await repository.saveChannelMessageId({ messageId: input.messageId, channelMessageId: input.channelMessageId });
  await repository.updateDelivery({ messageId: input.messageId, delivery: DeliveryState.Sent });
}

export async function recordFailure(input: { dependencies: CoreDependencies; messageId: string; error: unknown }): Promise<void> {
  const { repository } = input.dependencies;
  const { messageId, error } = input;
  await repository.updateDelivery({ messageId, delivery: DeliveryState.Failed });
  if (!(error instanceof ChannelError) || error.errorCode === null) return;
  const detail = { errorCode: error.errorCode, errorTitle: null, pricingCategory: null, billable: null };
  await repository.saveChannelStatusDetail({ messageId, detail });
}

export function deliveryFailureOf(input: { error: unknown; kind: MessageKind }): InboxError {
  if (input.error instanceof InboxError) return input.error;
  return new InboxError({ code: ChannelErrorKind.DeliveryFailed, message: `delivery failed for ${input.kind}` });
}
