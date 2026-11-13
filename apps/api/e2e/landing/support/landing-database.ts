import { openDatabase } from '../../backoffice/support/operator-database';

export type WaitlistRow = { email: string; referral_code: string; referred_by: string | null; credited: number; source: string };

const SELECT_ROWS = 'SELECT email, referral_code, referred_by, credited, source FROM landing_waitlist ORDER BY rowid';
const CLEAR_STATEMENTS = ['DELETE FROM landing_waitlist', "UPDATE site_settings SET value = '5' WHERE key = 'waitlist_referral_cap'"];
const READ_CAP = "SELECT value FROM site_settings WHERE key = 'waitlist_referral_cap'";

export function waitlistRows(): WaitlistRow[] {
  const database = openDatabase();
  const rows = database.prepare(SELECT_ROWS).all() as WaitlistRow[];
  database.close();
  return rows;
}

export function rowOf(input: { email: string }): WaitlistRow {
  const row = waitlistRows().find((candidate) => candidate.email === input.email);
  if (row === undefined) throw new Error(`no waitlist row for ${input.email}`);
  return row;
}

export function resetWaitlist(): void {
  const database = openDatabase();
  CLEAR_STATEMENTS.forEach((statement) => database.exec(statement));
  database.close();
}

export function storedCap(): number {
  const database = openDatabase();
  const row = database.prepare(READ_CAP).get() as { value: string };
  database.close();
  return Number(row.value);
}
