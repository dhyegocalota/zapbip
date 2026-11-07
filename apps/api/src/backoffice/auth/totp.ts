import { TOTP_DIGITS, TOTP_PERIOD_MS, TOTP_WINDOW_STEPS } from '../../contract/constants';
import { decodeBase32 } from './base32';
import { constantTimeEqual } from './constant-time';

const HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-1' };
const COUNTER_BYTES = 8;
const LOW_NIBBLE_MASK = 0x0f;
const SIGN_BIT_MASK = 0x7f;
const BYTE_MASK = 0xff;
const TRUNCATED_BYTES = 4;
const DECIMAL_BASE = 10;
const CODE_PATTERN = new RegExp(`^[0-9]{${TOTP_DIGITS}}$`);

function counterBytesOf(input: { step: number }): Uint8Array {
  const counter = new DataView(new ArrayBuffer(COUNTER_BYTES));
  counter.setBigUint64(0, BigInt(input.step));
  return new Uint8Array(counter.buffer);
}

export async function totpCodeAt(input: { secretBase32: string; step: number }): Promise<string> {
  const key = await crypto.subtle.importKey('raw', decodeBase32({ value: input.secretBase32 }), HMAC_ALGORITHM, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign(HMAC_ALGORITHM.name, key, counterBytesOf({ step: input.step })));
  const offset = digest[digest.length - 1]! & LOW_NIBBLE_MASK;
  const truncated = Array.from({ length: TRUNCATED_BYTES }, (_, index) => digest[offset + index]!).reduce(
    (value, byte, index) => value * (BYTE_MASK + 1) + (index === 0 ? byte & SIGN_BIT_MASK : byte),
    0,
  );
  return String(truncated % DECIMAL_BASE ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export async function matchTotpStep(input: { secretBase32: string; code: string; now: number; lastStep: number }): Promise<number | null> {
  const currentStep = Math.floor(input.now / TOTP_PERIOD_MS);
  const candidateSteps = Array.from({ length: 2 * TOTP_WINDOW_STEPS + 1 }, (_, index) => currentStep - TOTP_WINDOW_STEPS + index);
  const expectedCodes = await Promise.all(candidateSteps.map((step) => totpCodeAt({ secretBase32: input.secretBase32, step })));
  const isWellFormed = CODE_PATTERN.test(input.code);
  const matchingSteps = candidateSteps.filter(
    (step, index) => constantTimeEqual({ left: expectedCodes[index]!, right: input.code }) && isWellFormed && step > input.lastStep,
  );
  return matchingSteps.length === 0 ? null : matchingSteps[matchingSteps.length - 1]!;
}
