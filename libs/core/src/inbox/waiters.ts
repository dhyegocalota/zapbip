import type { Clock, ReplyWaiters } from './ports';

export function createReplyWaiters(input: { clock: Clock }): ReplyWaiters {
  void input;
  throw new Error('createReplyWaiters is not implemented');
}
