import { CommandKind, OwnerLocale } from '@zapbip/types';
import type { AccountCommand, CommandInput } from './account-types';
import { COMMAND_WORDS, MENU_COMMAND_KINDS, type CommandWord } from './command-words';
import { foldCommandText } from './command-folding';
import { COMMAND_LIST_ID_PREFIX } from './constants';

const WHITESPACE_PATTERN = /\s+/g;
const FOLDED_COMMAND_WORDS = COMMAND_WORDS.map((entry) => ({ entry, folded: foldCommandText({ text: entry.words }) }));

type CommandWordMatch = { entry: CommandWord; folded: string; collapsed: string };

export function formatMenuRowId(input: { kind: CommandKind }): string {
  return `${COMMAND_LIST_ID_PREFIX}${input.kind}`;
}

function parseListReply(input: { listReplyId: string; locale: OwnerLocale }): AccountCommand | null {
  if (!input.listReplyId.startsWith(COMMAND_LIST_ID_PREFIX)) return null;
  const menuKind = MENU_COMMAND_KINDS.find((kind) => formatMenuRowId({ kind }) === input.listReplyId);
  const kind = menuKind === undefined ? CommandKind.Unknown : menuKind;
  return { kind, rawName: null, locale: input.locale };
}

function matchesOf(input: { text: string }): CommandWordMatch[] {
  const collapsed = foldCommandText({ text: input.text.trim().replace(WHITESPACE_PATTERN, ' ') });
  const lowered = collapsed.toLowerCase();
  return FOLDED_COMMAND_WORDS.filter(
    ({ entry, folded }) => lowered === folded || (entry.takesName && lowered.startsWith(`${folded} `)),
  ).map(({ entry, folded }) => ({ entry, folded, collapsed }));
}

export function commandWordLocaleOf(input: { text: string }): OwnerLocale | null {
  const matchedLocales = [...new Set(matchesOf(input).map(({ entry }) => entry.locale))];
  if (matchedLocales.length !== 1) return null;
  return matchedLocales[0]!;
}

function parseText(input: { text: string }): AccountCommand | null {
  const [match] = matchesOf(input);
  if (match === undefined) return null;
  const rawName = match.entry.takesName ? match.collapsed.slice(match.folded.length).trim() : null;
  return { kind: match.entry.kind, rawName, locale: match.entry.locale };
}

export function parseAccountCommand(input: CommandInput): AccountCommand | null {
  if (input.isQuoting) return null;
  if (input.listReplyId !== null) return parseListReply({ listReplyId: input.listReplyId, locale: input.locale });
  if (input.text === null) return null;
  return parseText({ text: input.text });
}
