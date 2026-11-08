import { RATE_LIMIT_PERIOD_MS } from '@zapbip/core';
import { SECOND_MS } from '@zapbip/types';
import { clientRateKey } from '../../routes/client-rate-key';

export enum RateLimitScope {
  SignIn = '',
  StepUp = 'step-up:',
}

export const RETRY_AFTER_SECONDS = String(RATE_LIMIT_PERIOD_MS / SECOND_MS);

export async function isWithinRateLimit(input: { limiter: RateLimit; address: string; scope: RateLimitScope }): Promise<boolean> {
  const { success } = await input.limiter.limit({ key: `${input.scope}${clientRateKey({ address: input.address })}` });
  return success;
}
