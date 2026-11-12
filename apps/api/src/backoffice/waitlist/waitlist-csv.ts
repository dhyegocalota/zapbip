export type WaitlistListRow = {
  email: string;
  joinedAt: number;
  creditedCount: number;
  referredByEmail: string | null;
};

export function toWaitlistCsv(input: { rows: WaitlistListRow[] }): string {
  throw new Error(`toWaitlistCsv is not implemented ${input.rows.length}`);
}
