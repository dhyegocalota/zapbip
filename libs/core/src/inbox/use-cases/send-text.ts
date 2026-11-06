import type { SendTextInput, SendResult } from './types';

export function sendText(input: SendTextInput): Promise<SendResult> {
  void input;
  throw new Error('sendText is not implemented');
}
