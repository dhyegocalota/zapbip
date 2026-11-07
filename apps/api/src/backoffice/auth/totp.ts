export async function totpCodeAt(_input: { secretBase32: string; step: number }): Promise<string> {
  throw new Error('totpCodeAt is not implemented');
}

export async function matchTotpStep(_input: { secretBase32: string; code: string; now: number; lastStep: number }): Promise<number | null> {
  throw new Error('matchTotpStep is not implemented');
}
