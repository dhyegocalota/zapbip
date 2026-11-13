import { DAY_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { INVITE_CODE_ALPHABET, INVITE_CODE_MASK, INVITE_CODE_PREFIX, INVITE_CODE_RANDOM_LENGTH } from './constants';
import { createInviteCode, findInviteCode, isInviteLive, redactInviteCodes } from './invite-code';

const NOW = 10 * DAY_MS;
const CODE = `${INVITE_CODE_PREFIX}${'a2b3c4d5e6'.repeat(2)}wxyz`;

describe('findInviteCode', () => {
  test('finds a code inside a sentence and lowercases it', () => {
    expect(findInviteCode({ text: `Hi! My invite: ${CODE.toUpperCase()} thanks` })).toBe(CODE);
  });

  test.each([null, '', 'hello', `${INVITE_CODE_PREFIX}short`, 'zbx_a2b3c4d5e6a2b3c4d5e6wxyz', `x${CODE}`, `${CODE}a`, `${CODE}_`])(
    'finds nothing in %s',
    (text) => {
      expect(findInviteCode({ text })).toBeNull();
    },
  );

  test('takes the first code when a message carries two', () => {
    const second = `${INVITE_CODE_PREFIX}${'z'.repeat(INVITE_CODE_RANDOM_LENGTH)}`;
    expect(findInviteCode({ text: `${CODE} ${second}` })).toBe(CODE);
  });
});

describe('isInviteLive', () => {
  test('is live before it expires and while unused', () => {
    expect(isInviteLive({ expiresAt: NOW + 1, usedAt: null, now: NOW })).toBe(true);
  });

  test.each([
    { expiresAt: NOW, usedAt: null },
    { expiresAt: NOW - 1, usedAt: null },
    { expiresAt: NOW + DAY_MS, usedAt: NOW - 1 },
  ])('is not live for %o', ({ expiresAt, usedAt }) => {
    expect(isInviteLive({ expiresAt, usedAt, now: NOW })).toBe(false);
  });
});

describe('createInviteCode', () => {
  test('builds a code the finder recognises from random bytes', () => {
    const code = createInviteCode({ randomBytes: Uint8Array.from({ length: INVITE_CODE_RANDOM_LENGTH }, (_, index) => index * 7) });
    expect(code.startsWith(INVITE_CODE_PREFIX)).toBe(true);
    expect(code).toHaveLength(INVITE_CODE_PREFIX.length + INVITE_CODE_RANDOM_LENGTH);
    expect(findInviteCode({ text: code })).toBe(code);
  });

  test('two different byte sequences give two codes', () => {
    const zeros = createInviteCode({ randomBytes: new Uint8Array(INVITE_CODE_RANDOM_LENGTH) });
    const ones = createInviteCode({ randomBytes: new Uint8Array(INVITE_CODE_RANDOM_LENGTH).fill(1) });
    expect(zeros).not.toBe(ones);
  });
});

describe('redactInviteCodes', () => {
  test('masks every code in any letter case and keeps the rest of the text', () => {
    expect(redactInviteCodes({ text: `Hi ${CODE} and ${CODE.toUpperCase()}!` })).toBe(`Hi ${INVITE_CODE_MASK} and ${INVITE_CODE_MASK}!`);
  });

  test('leaves a text without a code unchanged', () => {
    expect(redactInviteCodes({ text: 'hello zbi_short' })).toBe('hello zbi_short');
  });
});

describe('the code alphabet', () => {
  test('divides the 256 byte values evenly so no character is likelier', () => {
    expect(256 % INVITE_CODE_ALPHABET.length).toBe(0);
  });

  test('keeps at least 120 bits of entropy', () => {
    expect(INVITE_CODE_RANDOM_LENGTH * Math.log2(INVITE_CODE_ALPHABET.length)).toBeGreaterThanOrEqual(120);
  });

  test('gives bytes that differ by the alphabet size the same character', () => {
    const low = createInviteCode({ randomBytes: new Uint8Array(INVITE_CODE_RANDOM_LENGTH).fill(3) });
    const high = createInviteCode({ randomBytes: new Uint8Array(INVITE_CODE_RANDOM_LENGTH).fill(3 + INVITE_CODE_ALPHABET.length) });
    expect(high).toBe(low);
  });
});
