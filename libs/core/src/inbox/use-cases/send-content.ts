import { IdPrefix } from '@zapbip/types';
import { notFound } from '../inbox-error-factories';
import type { MessageContent } from '../message';
import type { CoreDependencies } from '../ports';
import { deliverToOwner } from './deliver-to-owner';
import { touchAgent } from './touch-agent';
import type { CallContext, SendResult } from './types';

export async function assertMessageExists(input: { dependencies: CoreDependencies; messageId: string; field: string }): Promise<void> {
  const message = await input.dependencies.repository.findMessage({ messageId: input.messageId });
  if (message === null) throw notFound({ message: `${input.field}: message not found` });
}

export async function sendContent(input: CallContext & { content: MessageContent; replyToMessageId: string | null }): Promise<SendResult> {
  const { dependencies, connection, content, replyToMessageId } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  if (replyToMessageId !== null) await assertMessageExists({ dependencies, messageId: replyToMessageId, field: 'reply_to' });
  const messageId = dependencies.ids.next({ prefix: IdPrefix.Message });
  const { delivery } = await deliverToOwner({
    dependencies,
    ownerLocale: connection.ownerLocale,
    agent: connection.agent,
    messageId,
    content,
    replyToMessageId,
  });
  return { messageId, delivery };
}
