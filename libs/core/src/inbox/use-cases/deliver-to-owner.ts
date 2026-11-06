import { ChannelErrorKind, DeliveryState, MessageDirection, MessageKind, TemplateKind, type OwnerLocale } from '@zapbip/types';
import { InboxError } from '../errors';
import { buildNoticePreview } from '../inbox-copy';
import type { Message, MessageContent } from '../message';
import type { CoreDependencies } from '../ports';
import { isOwnerWindowOpen } from '../window';
import { flushQueue } from './flush-queue';
import type { DeliverToOwnerInput, DeliverToOwnerResult } from './types';

function deliveryFailure(input: { kind: MessageKind }): InboxError {
  return new InboxError({ code: ChannelErrorKind.DeliveryFailed, message: `delivery failed for ${input.kind}` });
}

async function noticePreview(input: { dependencies: CoreDependencies; content: MessageContent; locale: OwnerLocale }): Promise<string> {
  const { content, locale } = input;
  if (content.kind !== MessageKind.Choice) return buildNoticePreview({ content, locale });
  const question = await input.dependencies.repository.findQuestion({ questionId: content.questionId });
  if (question === null) return buildNoticePreview({ content, locale });
  return buildNoticePreview({ content: { kind: MessageKind.Text, text: question.text }, locale });
}

async function sendSession(input: { dependencies: CoreDependencies; message: Message }): Promise<DeliverToOwnerResult> {
  const { dependencies, message } = input;
  await flushQueue({ dependencies });
  const current = await dependencies.repository.findMessage({ messageId: message.messageId });
  const isSent = current !== null && current.delivery === DeliveryState.Sent;
  if (!isSent) throw deliveryFailure({ kind: message.kind });
  return { delivery: DeliveryState.Sent };
}

async function releaseNotice(input: { dependencies: CoreDependencies }): Promise<void> {
  const { repository } = input.dependencies;
  const window = await repository.findWindow();
  await repository.saveWindow({ window: { ...window, noticeSentForClosedWindow: false } });
}

async function queueWithNotice(input: DeliverToOwnerInput & { message: Message }): Promise<DeliverToOwnerResult> {
  const { dependencies, ownerLocale, agent, message, content } = input;
  const { repository, sender } = dependencies;
  const queued = { delivery: DeliveryState.Queued } as const;
  if (agent === null) return queued;
  const isNoticeOwner = await repository.claimNotice();
  if (!isNoticeOwner) return queued;
  const preview = await noticePreview({ dependencies, content, locale: ownerLocale });
  const kind = content.kind === MessageKind.Choice ? TemplateKind.QuestionNotice : TemplateKind.Notice;
  try {
    await sender.template({ kind, locale: ownerLocale, parameters: [agent, preview] });
  } catch {
    await releaseNotice({ dependencies });
    await repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Failed });
    throw deliveryFailure({ kind: message.kind });
  }
  return queued;
}

export async function deliverToOwner(input: DeliverToOwnerInput): Promise<DeliverToOwnerResult> {
  const { dependencies, agent, messageId, content, replyToMessageId } = input;
  const { repository, clock } = dependencies;
  const message: Message = {
    messageId,
    direction: MessageDirection.ToOwner,
    agent,
    at: clock.now(),
    replyToMessageId,
    delivery: DeliveryState.Queued,
    readByAgent: true,
    handedTo: null,
    originMessageId: null,
    ...content,
  };
  await repository.insertMessage({ message });
  const window = await repository.findWindow();
  if (isOwnerWindowOpen({ window, now: clock.now() })) return sendSession({ dependencies, message });
  return queueWithNotice({ ...input, message });
}
