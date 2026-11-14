import { OwnerLocale, WaitlistSource } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { toWaitlistCsv, type WaitlistListRow } from '../../src/backoffice/waitlist/waitlist-csv';

const HEADERS: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: 'email,joined_at,credited_referrals,referred_by,source\n',
  [OwnerLocale.PortugueseBrazil]: 'email,entrou_em,indicacoes_creditadas,indicado_por,origem\n',
  [OwnerLocale.Spanish]: 'email,registrado_en,invitaciones_acreditadas,invitado_por,origen\n',
  [OwnerLocale.German]: 'email,beigetreten_am,gutgeschriebene_einladungen,eingeladen_von,quelle\n',
  [OwnerLocale.French]: 'email,inscrit_le,parrainages_credites,parraine_par,origine\n',
  [OwnerLocale.Japanese]: 'email,登録日時,加算済み紹介数,紹介者,流入元\n',
  [OwnerLocale.Korean]: 'email,가입일시,반영된_추천수,추천인,유입경로\n',
  [OwnerLocale.ChineseSimplified]: 'email,加入时间,已计入邀请数,邀请人,来源\n',
  [OwnerLocale.Arabic]: 'email,تاريخ_الانضمام,الدعوات_المحتسبة,مدعو_من,المصدر\n',
};
const HEADER = HEADERS[OwnerLocale.EnglishUs];
const JOINED_AT = Date.UTC(2026, 10, 12, 9, 30);
const ISO_JOINED_AT = '2026-11-12T09:30:00.000Z';
const BULK_ROW_COUNT = 5_000;

function rowOf(input: { email: string; referredByEmail?: string | null; creditedCount?: number }): WaitlistListRow {
  const { email, referredByEmail = null, creditedCount = 0 } = input;
  return { email, joinedAt: JOINED_AT, creditedCount, referredByEmail, source: WaitlistSource.Form };
}

describe('toWaitlistCsv', () => {
  it('has exactly the header row and a line break for zero rows', () => {
    expect(toWaitlistCsv({ rows: [], locale: OwnerLocale.EnglishUs })).toBe(HEADER);
  });

  it('quotes every cell and writes the joined time as ISO 8601 UTC', () => {
    expect(
      toWaitlistCsv({
        rows: [rowOf({ email: 'maria@example.com', creditedCount: 2, referredByEmail: 'joao@example.com' })],
        locale: OwnerLocale.EnglishUs,
      }),
    ).toBe(`${HEADER}"maria@example.com","${ISO_JOINED_AT}","2","joao@example.com","form"\n`);
  });

  it('writes an empty referrer as an empty quoted cell', () => {
    expect(toWaitlistCsv({ rows: [rowOf({ email: 'maria@example.com' })], locale: OwnerLocale.EnglishUs })).toContain(',"0","","form"\n');
  });

  it('quotes every cell and escapes quotes and commas', () => {
    const csv = toWaitlistCsv({ rows: [rowOf({ email: 'a,"b"@example.com' })], locale: OwnerLocale.EnglishUs });
    expect(csv).toContain('"a,""b""@example.com"');
  });

  it('neutralises a formula cell', () => {
    const csv = toWaitlistCsv({ rows: [rowOf({ email: '=HYPERLINK("x")' })], locale: OwnerLocale.EnglishUs });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toContain('"=HYPERLINK');
  });

  it.each(['+1@example.com', '-1@example.com', '@handle@example.com'])('prefixes %s with an apostrophe inside the quotes', (email) => {
    expect(toWaitlistCsv({ rows: [rowOf({ email })], locale: OwnerLocale.EnglishUs })).toContain(`"'${email}"`);
  });

  it('neutralises a formula in the referrer cell too', () => {
    expect(
      toWaitlistCsv({ rows: [rowOf({ email: 'maria@example.com', referredByEmail: '=1+1' })], locale: OwnerLocale.EnglishUs }),
    ).toContain(`"'=1+1"`);
  });

  it('writes one line per row for a bulk export', () => {
    const rows = Array.from({ length: BULK_ROW_COUNT }, (_, index) => rowOf({ email: `person${index}@example.com` }));
    expect(toWaitlistCsv({ rows, locale: OwnerLocale.EnglishUs }).split('\n')).toHaveLength(BULK_ROW_COUNT + 2);
  });

  it.each(Object.values(OwnerLocale))('writes the header row in %s', (locale) => {
    expect(toWaitlistCsv({ rows: [], locale })).toBe(HEADERS[locale]);
  });
});
