import { WAITLIST_REFERRAL_CODE_ALPHABET, WAITLIST_REFERRAL_CODE_LENGTH } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { createReferralCode } from '../../src/site/referral-code';

const SAMPLE_COUNT = 1_000;
const LOOK_ALIKE_CHARACTERS = ['0', '1', 'o', 'i', 'l', 'u'];
const ALPHABET_CHARACTERS = new Set(WAITLIST_REFERRAL_CODE_ALPHABET);

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

describe('createReferralCode', () => {
  it('creates 12 characters from the base32 alphabet without look-alike characters', () => {
    const code = createReferralCode({ randomBytes });
    expect(code).toHaveLength(WAITLIST_REFERRAL_CODE_LENGTH);
    expect(Array.from(code).every((character) => ALPHABET_CHARACTERS.has(character))).toBe(true);
    expect(LOOK_ALIKE_CHARACTERS.filter((character) => code.includes(character))).toEqual([]);
  });

  it('two calls differ across 1000 calls', () => {
    const codes = Array.from({ length: SAMPLE_COUNT }, () => createReferralCode({ randomBytes }));
    expect(new Set(codes).size).toBe(SAMPLE_COUNT);
  });

  it('draws again when the first bytes fall outside the unbiased range', () => {
    const batches = [new Uint8Array(48).fill(255), new Uint8Array(48).fill(0)];
    const code = createReferralCode({ randomBytes: () => batches.shift()! });
    expect(code).toBe(WAITLIST_REFERRAL_CODE_ALPHABET[0]!.repeat(WAITLIST_REFERRAL_CODE_LENGTH));
  });
});
