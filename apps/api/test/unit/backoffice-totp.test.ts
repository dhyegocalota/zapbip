import { describe, expect, it } from 'vitest';
import { SECOND_MS } from '@zapbip/types';
import { decodeBase32, encodeBase32 } from '../../src/backoffice/auth/base32';
import { matchTotpStep, totpCodeAt } from '../../src/backoffice/auth/totp';
import { TOTP_PERIOD_MS } from '../../src/contract/constants';

const RFC_SECRET_ASCII = '12345678901234567890';
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const NO_PREVIOUS_STEP = 0;
const CURRENT_STEP = 1_000_000;
const NOW = CURRENT_STEP * TOTP_PERIOD_MS + 5 * SECOND_MS;

const RFC_VECTORS: { seconds: number; code: string }[] = [
  { seconds: 59, code: '287082' },
  { seconds: 1111111109, code: '081804' },
  { seconds: 1111111111, code: '050471' },
  { seconds: 1234567890, code: '005924' },
  { seconds: 2000000000, code: '279037' },
  { seconds: 20000000000, code: '353130' },
];

function stepOfSeconds(input: { seconds: number }): number {
  return Math.floor((input.seconds * SECOND_MS) / TOTP_PERIOD_MS);
}

function matchAt(input: { step: number; lastStep?: number }): Promise<number | null> {
  return codeAt({ step: input.step }).then((code) =>
    matchTotpStep({
      secretBase32: RFC_SECRET_BASE32,
      code,
      now: NOW,
      lastStep: input.lastStep === undefined ? NO_PREVIOUS_STEP : input.lastStep,
    }),
  );
}

function codeAt(input: { step: number }): Promise<string> {
  return totpCodeAt({ secretBase32: RFC_SECRET_BASE32, step: input.step });
}

describe('base32', () => {
  it('round-trips the RFC 6238 secret', () => {
    const bytes = new TextEncoder().encode(RFC_SECRET_ASCII);
    expect(encodeBase32({ bytes })).toBe(RFC_SECRET_BASE32);
    expect(new TextDecoder().decode(decodeBase32({ value: RFC_SECRET_BASE32 }))).toBe(RFC_SECRET_ASCII);
  });
});

describe('totp code', () => {
  it.each(RFC_VECTORS)('accepts the RFC 6238 code at time $seconds', async ({ seconds, code }) => {
    expect(await totpCodeAt({ secretBase32: RFC_SECRET_BASE32, step: stepOfSeconds({ seconds }) })).toBe(code);
  });
});

describe('totp step match', () => {
  it('accepts the current step', async () => {
    expect(await matchAt({ step: CURRENT_STEP })).toBe(CURRENT_STEP);
  });

  it('accepts one step before and one step after', async () => {
    expect(await matchAt({ step: CURRENT_STEP - 1 })).toBe(CURRENT_STEP - 1);
    expect(await matchAt({ step: CURRENT_STEP + 1 })).toBe(CURRENT_STEP + 1);
  });

  it('refuses two steps before', async () => {
    expect(await matchAt({ step: CURRENT_STEP - 2 })).toBeNull();
  });

  it('refuses a step equal to the last accepted step', async () => {
    expect(await matchAt({ step: CURRENT_STEP, lastStep: CURRENT_STEP })).toBeNull();
  });

  it('refuses a step below the last accepted step', async () => {
    expect(await matchAt({ step: CURRENT_STEP - 1, lastStep: CURRENT_STEP })).toBeNull();
  });

  it.each(['12345', '1234567', '12a456', ''])('refuses the malformed code "%s" without throwing', async (code) => {
    expect(await matchTotpStep({ secretBase32: RFC_SECRET_BASE32, code, now: NOW, lastStep: NO_PREVIOUS_STEP })).toBeNull();
  });
});
