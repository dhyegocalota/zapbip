import { INVITE_CODE_ALPHABET, INVITE_CODE_PATTERN, INVITE_CODE_PREFIX } from './constants';

export function findInviteCode(input: { text: string | null }): string | null {
  if (input.text === null) return null;
  const match = INVITE_CODE_PATTERN.exec(input.text);
  return match === null ? null : match[0].toLowerCase();
}

export function isInviteLive(input: { expiresAt: number; usedAt: number | null; now: number }): boolean {
  const { expiresAt, usedAt, now } = input;
  return usedAt === null && expiresAt > now;
}

export function createInviteCode(input: { randomBytes: Uint8Array }): string {
  const characters = Array.from(input.randomBytes, (byte) => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length]);
  return `${INVITE_CODE_PREFIX}${characters.join('')}`;
}
