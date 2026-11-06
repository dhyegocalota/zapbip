import { IdPrefix } from '@zapbip/types';
import { notFound } from '../inbox-error-factories';
import { ownerMessageIdOf, type Message, type MessageContent } from '../message';
import type { CoreDependencies } from '../ports';
import { deliverToOwner } from './deliver-to-owner';
import { touchAgent } from './touch-agent';
import type { CallContext, SendResult } from './types';

export async function assertMessageExists(input: { dependencies: CoreDependencies; messageId: string; field: string }): Promise<Message> {
  const message = await input.dependencies.repository.findMessage({ messageId: input.messageId });
  if (message === null) throw notFound({ message: `${input.field}: message not found` });
  return message;
}

export async function sendContent(input: CallContext & { content: MessageContent; replyToMessageId: string | null }): Promise<SendResult> {
  const { dependencies, connection, content, replyToMessageId } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  const repliedTo =
    replyToMessageId === null ? null : await assertMessageExists({ dependencies, messageId: replyToMessageId, field: 'reply_to' });
  const storedReplyToMessageId = repliedTo === null ? null : ownerMessageIdOf({ message: repliedTo });
  const messageId = dependencies.ids.next({ prefix: IdPrefix.Message });
  const { delivery } = await deliverToOwner({
    dependencies,
    ownerLocale: connection.ownerLocale,
    agent: connection.agent,
    messageId,
    content,
    replyToMessageId: storedReplyToMessageId,
  });
  return { messageId, delivery };
}
