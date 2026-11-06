import { MessageKind } from '@zapbip/types';
import { WHATSAPP_TEXT_MAX_CHARS } from '../constants';
import { assertMaxChars } from '../validation';
import { sendContent } from './send-content';
import type { SendResult, SendTextInput } from './types';

export function sendText(input: SendTextInput): Promise<SendResult> {
  const { dependencies, connection, text, replyToMessageId } = input;
  assertMaxChars({ field: 'text', value: text, maxChars: WHATSAPP_TEXT_MAX_CHARS });
  return sendContent({ dependencies, connection, content: { kind: MessageKind.Text, text }, replyToMessageId });
}
