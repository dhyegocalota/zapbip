import type { SendMediaInput, SendResult } from './types';

export function sendMedia(input: SendMediaInput): Promise<SendResult> {
  void input;
  throw new Error('sendMedia is not implemented');
}
