export function findInviteCode(input: { text: string | null }): string | null {
  throw new Error('findInviteCode is not implemented');
}

export function isInviteLive(input: { expiresAt: number; usedAt: number | null; now: number }): boolean {
  throw new Error('isInviteLive is not implemented');
}

export function createInviteCode(input: { randomBytes: Uint8Array }): string {
  throw new Error('createInviteCode is not implemented');
}
