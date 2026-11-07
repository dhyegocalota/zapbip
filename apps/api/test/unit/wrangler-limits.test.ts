import {
  ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE,
  OUTBOUND_MESSAGES_PER_MINUTE,
  OWNER_MESSAGES_PER_MINUTE,
  RATE_LIMIT_PERIOD_MS,
} from '@zapbip/core';
import { INSTALL_PAGE_REQUESTS_PER_MINUTE, SECOND_MS } from '@zapbip/types';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig as readConfig } from 'wrangler';

const CONFIG_PATH = join(import.meta.dirname, '..', '..', 'wrangler.jsonc');
const DEVELOPMENT_ENVIRONMENT = 'development';
const EXPECTED_LIMITS: Record<string, number> = {
  OWNER_RATE_LIMITER: OWNER_MESSAGES_PER_MINUTE,
  OUTBOUND_RATE_LIMITER: OUTBOUND_MESSAGES_PER_MINUTE,
  ACCOUNT_OUTBOUND_RATE_LIMITER: ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE,
  INSTALL_PAGE_LIMITER: INSTALL_PAGE_REQUESTS_PER_MINUTE,
};
const environments = [
  { name: DEVELOPMENT_ENVIRONMENT, environment: DEVELOPMENT_ENVIRONMENT, waitlistEnabled: 'false' },
  { name: 'production', environment: undefined, waitlistEnabled: 'true' },
];

describe.each(environments)('wrangler $name environment', ({ environment, waitlistEnabled }) => {
  const config = readConfig({ config: CONFIG_PATH, env: environment });

  it.each(Object.entries(EXPECTED_LIMITS))('ties %s to its constant and the period', (name, limit) => {
    const limiter = config.ratelimits.find((candidate: { name: string }) => candidate.name === name);
    expect(limiter?.simple).toEqual({ limit, period: RATE_LIMIT_PERIOD_MS / SECOND_MS });
  });

  it('sets the waitlist flag', () => {
    expect(config.vars.WAITLIST_ENABLED).toBe(waitlistEnabled);
  });
});
