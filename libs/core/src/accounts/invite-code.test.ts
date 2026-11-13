import { DAY_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { INVITE_CODE_PREFIX, INVITE_CODE_RANDOM_LENGTH } from './constants';
import { createInviteCode, findInviteCode, isInviteLive } from './invite-code';

const NOW = 10 * DAY_MS;
const CODE = `${INVITE_CODE_PREFIX}${'a1b2c3d4e5'.repeat(2)}wxyz`;

describe('findInviteCode', () => {
  test('finds a code inside a sentence and lowercases it', () => {
    expect(findInviteCode({ text: `Hi! My invite: ${CODE.toUpperCase()} thanks` })).toBe(CODE);
  });

  test.each([null, '', 'hello', `${INVITE_CODE_PREFIX}short`, 'zbx_a1b2c3d4e5a1b2c3d4e5wxyz'])('finds nothing in %s', (text) => {
    expect(findInviteCode({ text })).toBeNull();
  });

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
