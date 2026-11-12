export function createReferralCode(input: { randomBytes: (length: number) => Uint8Array }): string {
  throw new Error(`createReferralCode is not implemented ${input.randomBytes.length}`);
}
