import { OwnerLocale } from '@zapbip/types';
export type WaitlistListRow = {
  email: string;
  joinedAt: number;
  creditedCount: number;
  referredByEmail: string | null;
};

const HEADER_CELLS: Record<OwnerLocale, string[]> = {
  [OwnerLocale.EnglishUs]: ['email', 'joined_at', 'credited_referrals', 'referred_by'],
  [OwnerLocale.PortugueseBrazil]: ['email', 'entrou_em', 'indicacoes_creditadas', 'indicado_por'],
};
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
const NEUTRALISING_PREFIX = "'";
const CELL_SEPARATOR = ',';
const LINE_BREAK = '\n';
const QUOTE = '"';

function cellOf(input: { text: string }): string {
  const { text } = input;
  const isFormula = FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix));
  const safeText = isFormula ? `${NEUTRALISING_PREFIX}${text}` : text;
  return `${QUOTE}${safeText.replaceAll(QUOTE, `${QUOTE}${QUOTE}`)}${QUOTE}`;
}

function lineOf(input: { row: WaitlistListRow }): string {
  const { row } = input;
  const cells = [
    row.email,
    new Date(row.joinedAt).toISOString(),
    String(row.creditedCount),
    row.referredByEmail === null ? '' : row.referredByEmail,
  ];
  return `${cells.map((text) => cellOf({ text })).join(CELL_SEPARATOR)}${LINE_BREAK}`;
}

export function toWaitlistCsv(input: { rows: WaitlistListRow[]; locale: OwnerLocale }): string {
  return `${HEADER_CELLS[input.locale].join(CELL_SEPARATOR)}${LINE_BREAK}${input.rows.map((row) => lineOf({ row })).join('')}`;
}
