import type { WaitlistListRow } from './waitlist-csv';

export async function countWaitlist(input: { database: D1Database }): Promise<number> {
  throw new Error(`countWaitlist is not implemented ${String(input.database)}`);
}

export async function listWaitlist(input: { database: D1Database; limit: number }): Promise<WaitlistListRow[]> {
  throw new Error(`listWaitlist is not implemented ${input.limit}`);
}
