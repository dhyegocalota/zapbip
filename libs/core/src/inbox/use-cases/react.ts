import type { ReactInput, SendResult } from './types';

export function react(input: ReactInput): Promise<SendResult> {
  void input;
  throw new Error('react is not implemented');
}
