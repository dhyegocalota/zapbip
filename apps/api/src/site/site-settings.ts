export async function readReferralCap(input: { database: D1Database }): Promise<number> {
  throw new Error(`readReferralCap is not implemented ${String(input.database)}`);
}

export async function writeReferralCap(input: { database: D1Database; value: number; now: number }): Promise<void> {
  throw new Error(`writeReferralCap is not implemented ${input.value}`);
}
