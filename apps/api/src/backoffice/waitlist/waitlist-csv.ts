import { WebLocale, type WaitlistSource } from '@zapbip/types';
export type WaitlistListRow = {
  email: string;
  joinedAt: number;
  creditedCount: number;
  referredByEmail: string | null;
  source: WaitlistSource;
};

const HEADER_CELLS: Record<WebLocale, string[]> = {
  [WebLocale.EnglishUs]: ['email', 'joined_at', 'credited_referrals', 'referred_by', 'source'],
  [WebLocale.PortugueseBrazil]: ['email', 'entrou_em', 'indicacoes_creditadas', 'indicado_por', 'origem'],
  [WebLocale.Spanish]: ['email', 'registrado_en', 'invitaciones_acreditadas', 'invitado_por', 'origen'],
  [WebLocale.German]: ['email', 'beigetreten_am', 'gutgeschriebene_einladungen', 'eingeladen_von', 'quelle'],
  [WebLocale.French]: ['email', 'inscrit_le', 'parrainages_credites', 'parraine_par', 'origine'],
  [WebLocale.Japanese]: ['email', '登録日時', '加算済み紹介数', '紹介者', '流入元'],
  [WebLocale.Korean]: ['email', '가입일시', '반영된_추천수', '추천인', '유입경로'],
  [WebLocale.ChineseSimplified]: ['email', '加入时间', '已计入邀请数', '邀请人', '来源'],
};
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
const NEUTRALISING_PREFIX = "'";
const CELL_SEPARATOR = ',';
const LINE_BREAK = '\n';
const QUOTE = '"';

export function cellOf(input: { text: string }): string {
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
    row.source,
  ];
  return `${cells.map((text) => cellOf({ text })).join(CELL_SEPARATOR)}${LINE_BREAK}`;
}

export function toWaitlistCsv(input: { rows: WaitlistListRow[]; locale: WebLocale }): string {
  return `${HEADER_CELLS[input.locale].join(CELL_SEPARATOR)}${LINE_BREAK}${input.rows.map((row) => lineOf({ row })).join('')}`;
}
