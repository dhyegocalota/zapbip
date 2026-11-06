import type { ReceiveAccountMessageInput, ReceiveAccountMessageResult } from './types';

export function receiveAccountMessage(input: ReceiveAccountMessageInput): Promise<ReceiveAccountMessageResult> {
  void input;
  throw new Error('receiveAccountMessage is not implemented');
}
