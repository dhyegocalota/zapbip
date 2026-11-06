import type { GetMessagesInput, GetMessagesResult } from './types';

export function getMessages(input: GetMessagesInput): Promise<GetMessagesResult> {
  void input;
  throw new Error('getMessages is not implemented');
}
