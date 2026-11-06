import type { AskInput, AskResult } from './types';

export function ask(input: AskInput): Promise<AskResult> {
  void input;
  throw new Error('ask is not implemented');
}
