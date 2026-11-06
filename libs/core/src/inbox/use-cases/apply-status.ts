import type { ApplyStatusInput, ApplyStatusResult } from './types';

export function applyStatus(input: ApplyStatusInput): Promise<ApplyStatusResult> {
  void input;
  throw new Error('applyStatus is not implemented');
}
