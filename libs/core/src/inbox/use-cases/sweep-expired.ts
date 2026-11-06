import type { SweepExpiredInput, SweepExpiredResult } from './types';

export function sweepExpired(input: SweepExpiredInput): Promise<SweepExpiredResult> {
  void input;
  throw new Error('sweepExpired is not implemented');
}
