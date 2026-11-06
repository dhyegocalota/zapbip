import type { OwnerLocale } from '@zapbip/types';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { sendNotice } from './send-notice';

export async function noticeOwner(input: { dependencies: CoreDependencies; ownerLocale: OwnerLocale; message: Message }): Promise<void> {
  const { dependencies, ownerLocale, message } = input;
  if (message.agent === null) return;
  await sendNotice({ dependencies, ownerLocale, agent: message.agent, content: message });
}
