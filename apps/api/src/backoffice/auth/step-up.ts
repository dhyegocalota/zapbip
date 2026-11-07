import type { Bindings } from '../../contract/env';

export enum StepUpOutcome {
  Accepted = 'accepted',
  Rejected = 'rejected',
  RateLimited = 'rate_limited',
}

export async function verifyStepUp(_input: {
  env: Bindings;
  code: string;
  now: number;
  clientAddress: string | null;
  targetKind: string;
  targetId: string;
}): Promise<StepUpOutcome> {
  throw new Error('verifyStepUp is not implemented');
}
