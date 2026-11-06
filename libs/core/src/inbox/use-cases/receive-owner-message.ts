import type { ReceiveOwnerMessageInput, ReceiveResult } from './types';

export function receiveOwnerMessage(input: ReceiveOwnerMessageInput): Promise<ReceiveResult> {
  void input;
  throw new Error('receiveOwnerMessage is not implemented');
}
