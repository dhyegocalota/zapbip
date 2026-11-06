import { MessageKind } from '@zapbip/types';
import { parseEmoji } from '../validation';
import { assertMessageExists, sendContent } from './send-content';
import type { ReactInput, SendResult } from './types';

export async function react(input: ReactInput): Promise<SendResult> {
  const { dependencies, connection, targetMessageId } = input;
  const emoji = input.emoji === null ? null : parseEmoji({ emoji: input.emoji });
  await assertMessageExists({ dependencies, messageId: targetMessageId, field: 'message_id' });
  return sendContent({ dependencies, connection, content: { kind: MessageKind.Reaction, targetMessageId, emoji }, replyToMessageId: null });
}
