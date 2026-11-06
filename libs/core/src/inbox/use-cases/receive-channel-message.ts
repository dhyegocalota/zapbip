import type { ReceiveChannelInput, ReceiveResult } from './types';

export function receiveChannelMessage(input: ReceiveChannelInput): Promise<ReceiveResult> {
  void input;
  throw new Error('receiveChannelMessage is not implemented');
}
