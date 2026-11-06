import type { WaitForReplyInput, WaitForReplyResult } from './types';

export function waitForReply(input: WaitForReplyInput): Promise<WaitForReplyResult> {
  void input;
  throw new Error('waitForReply is not implemented');
}
