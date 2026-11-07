import { CommandKind, DEFAULT_LOCALE } from '@zapbip/types';
import type { AccountCommand, CommandInput } from './account-types';
import { COMMAND_WORDS, MENU_COMMAND_KINDS } from './command-words';
import { COMMAND_LIST_ID_PREFIX } from './constants';

const WHITESPACE_PATTERN = /\s+/g;

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
  const collapsed = input.text.trim().replace(WHITESPACE_PATTERN, ' ');
  const lowered = collapsed.toLowerCase();
  const entry = COMMAND_WORDS.find((word) => lowered === word.words || (word.takesName && lowered.startsWith(`${word.words} `)));
  if (entry === undefined) return null;
  const rawName = entry.takesName ? collapsed.slice(entry.words.length).trim() : null;
  return { kind: entry.kind, rawName, locale: entry.locale };
}

export function parseAccountCommand(input: CommandInput): AccountCommand | null {
  if (input.isQuoting) return null;
  if (input.listReplyId !== null) return parseListReply({ listReplyId: input.listReplyId });
  if (input.text === null) return null;
  return parseText({ text: input.text });
}
