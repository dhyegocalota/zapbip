import type { OwnerLocale } from '@zapbip/types';
import { OWN_NOTICE_SENDER } from '../constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { sendNotice } from './send-notice';

export function noticeSenderOf(input: { message: Message }): string {
  const { agent } = input.message;
  return agent === null ? OWN_NOTICE_SENDER : agent;
}

export function pickNoticeMessage(input: { messages: Message[] }): Message | undefined {
  const agentMessage = input.messages.find((message) => message.agent !== null);
  if (agentMessage !== undefined) return agentMessage;
  const [firstMessage] = input.messages;
  return firstMessage;
}

export async function noticeOwner(input: { dependencies: CoreDependencies; ownerLocale: OwnerLocale; message: Message }): Promise<void> {
  const { dependencies, ownerLocale, message } = input;
  await sendNotice({ dependencies, ownerLocale, agent: noticeSenderOf({ message }), content: message });
}
