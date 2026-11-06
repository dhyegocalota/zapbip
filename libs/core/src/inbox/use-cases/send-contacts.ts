import type { SendContactsInput, SendResult } from './types';

export function sendContacts(input: SendContactsInput): Promise<SendResult> {
  void input;
  throw new Error('sendContacts is not implemented');
}
