import { WAITLIST_REFERRAL_CODE_ALPHABET, WAITLIST_REFERRAL_CODE_LENGTH } from '@zapbip/types';
import { REFERRAL_CODE_ACCEPT_LIMIT, REFERRAL_CODE_BYTE_BATCH } from './site-constants';

export function createReferralCode(input: { randomBytes: (length: number) => Uint8Array }): string {
  const characters = Array.from(input.randomBytes(REFERRAL_CODE_BYTE_BATCH))
    .filter((byte) => byte < REFERRAL_CODE_ACCEPT_LIMIT)
    .map((byte) => WAITLIST_REFERRAL_CODE_ALPHABET[byte % WAITLIST_REFERRAL_CODE_ALPHABET.length]);
  if (characters.length < WAITLIST_REFERRAL_CODE_LENGTH) return createReferralCode(input);
  return characters.slice(0, WAITLIST_REFERRAL_CODE_LENGTH).join('');
}

export function createRandomReferralCode(): string {
  return createReferralCode({ randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)) });
}

const REFERRAL_CODE_PATTERN = new RegExp(`^[${WAITLIST_REFERRAL_CODE_ALPHABET}]{${WAITLIST_REFERRAL_CODE_LENGTH}}$`);

export function isReferralCode(input: { value: string }): boolean {
  return REFERRAL_CODE_PATTERN.test(input.value);
}
