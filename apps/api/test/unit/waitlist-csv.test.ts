import { describe, expect, it } from 'vitest';
import { toWaitlistCsv, type WaitlistListRow } from '../../src/backoffice/waitlist/waitlist-csv';

const HEADER = 'email,joined_at,credited_referrals,referred_by\n';
const JOINED_AT = Date.UTC(2026, 10, 12, 9, 30);
const ISO_JOINED_AT = '2026-11-12T09:30:00.000Z';
const BULK_ROW_COUNT = 5_000;

function rowOf(input: { email: string; referredByEmail?: string | null; creditedCount?: number }): WaitlistListRow {
  const { email, referredByEmail = null, creditedCount = 0 } = input;
  return { email, joinedAt: JOINED_AT, creditedCount, referredByEmail };
}

describe('toWaitlistCsv', () => {
  it('has exactly the header row and a line break for zero rows', () => {
    expect(toWaitlistCsv({ rows: [] })).toBe(HEADER);
  });

  it('quotes every cell and writes the joined time as ISO 8601 UTC', () => {
    expect(toWaitlistCsv({ rows: [rowOf({ email: 'maria@example.com', creditedCount: 2, referredByEmail: 'joao@example.com' })] })).toBe(
      `${HEADER}"maria@example.com","${ISO_JOINED_AT}","2","joao@example.com"\n`,
    );
  });

  it('writes an empty referrer as an empty quoted cell', () => {
    expect(toWaitlistCsv({ rows: [rowOf({ email: 'maria@example.com' })] })).toContain(',"0",""\n');
  });

  it('quotes every cell and escapes quotes and commas', () => {
    const csv = toWaitlistCsv({ rows: [rowOf({ email: 'a,"b"@example.com' })] });
    expect(csv).toContain('"a,""b""@example.com"');
  });

  it('neutralises a formula cell', () => {
    const csv = toWaitlistCsv({ rows: [rowOf({ email: '=HYPERLINK("x")' })] });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toContain('"=HYPERLINK');
  });

  it.each(['+1@example.com', '-1@example.com', '@handle@example.com'])('prefixes %s with an apostrophe inside the quotes', (email) => {
    expect(toWaitlistCsv({ rows: [rowOf({ email })] })).toContain(`"'${email}"`);
  });

  it('neutralises a formula in the referrer cell too', () => {
    expect(toWaitlistCsv({ rows: [rowOf({ email: 'maria@example.com', referredByEmail: '=1+1' })] })).toContain(`"'=1+1"`);
  });

  it('writes one line per row for a bulk export', () => {
    const rows = Array.from({ length: BULK_ROW_COUNT }, (_, index) => rowOf({ email: `person${index}@example.com` }));
    expect(toWaitlistCsv({ rows }).split('\n')).toHaveLength(BULK_ROW_COUNT + 2);
  });
});
