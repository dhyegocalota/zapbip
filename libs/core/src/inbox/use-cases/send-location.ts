import type { SendLocationInput, SendResult } from './types';

export function sendLocation(input: SendLocationInput): Promise<SendResult> {
  void input;
  throw new Error('sendLocation is not implemented');
}
