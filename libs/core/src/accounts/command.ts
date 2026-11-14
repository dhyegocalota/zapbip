import { CommandKind, DEFAULT_LOCALE } from '@zapbip/types';
import type { AccountCommand, CommandInput } from './account-types';
import { COMMAND_WORDS, MENU_COMMAND_KINDS } from './command-words';
import { foldCommandText } from './command-folding';
import { COMMAND_LIST_ID_PREFIX } from './constants';

const WHITESPACE_PATTERN = /\s+/g;
const FOLDED_COMMAND_WORDS = COMMAND_WORDS.map((entry) => ({ entry, folded: foldCommandText({ text: entry.words }) }));

export function formatMenuRowId(input: { kind: CommandKind }): string {
  return `${COMMAND_LIST_ID_PREFIX}${input.kind}`;
}

function parseListReply(input: { listReplyId: string }): AccountCommand | null {
  if (!input.listReplyId.startsWith(COMMAND_LIST_ID_PREFIX)) return null;
  const menuKind = MENU_COMMAND_KINDS.find((kind) => formatMenuRowId({ kind }) === input.listReplyId);
  const kind = menuKind === undefined ? CommandKind.Unknown : menuKind;
  return { kind, rawName: null, locale: DEFAULT_LOCALE };
}

function parseText(input: { text: string }): AccountCommand | null {
  const collapsed = foldCommandText({ text: input.text.trim().replace(WHITESPACE_PATTERN, ' ') });
  const lowered = collapsed.toLowerCase();
  const match = FOLDED_COMMAND_WORDS.find(
    ({ entry, folded }) => lowered === folded || (entry.takesName && lowered.startsWith(`${folded} `)),
  );
  if (match === undefined) return null;
  const { entry, folded } = match;
  const rawName = entry.takesName ? collapsed.slice(folded.length).trim() : null;
  return { kind: entry.kind, rawName, locale: entry.locale };
}

export function parseAccountCommand(input: CommandInput): AccountCommand | null {
  if (input.isQuoting) return null;
  if (input.listReplyId !== null) return parseListReply({ listReplyId: input.listReplyId });
  if (input.text === null) return null;
  return parseText({ text: input.text });
}
