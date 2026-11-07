import { AGENT_NAME_PATTERN, OWN_NOTICE_SENDER } from '../inbox/constants';
import { COMMAND_WORDS } from './command-words';

const COMBINING_MARKS_PATTERN = /\p{M}/gu;
const NON_ALPHANUMERIC_RUN_PATTERN = /[^a-z0-9]+/g;
const EDGE_HYPHENS_PATTERN = /^-+|-+$/g;
const WORD_SEPARATOR = ' ';

const RESERVED_AGENT_NAMES: ReadonlySet<string> = new Set([
  ...COMMAND_WORDS.map((entry) => entry.words.split(WORD_SEPARATOR)[0]!),
  OWN_NOTICE_SENDER,
]);

export function normalizeAgentName(input: { rawName: string }): string | null {
  const name = input.rawName
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_RUN_PATTERN, '-')
    .replace(EDGE_HYPHENS_PATTERN, '');
  if (!AGENT_NAME_PATTERN.test(name)) return null;
  return name;
}

export function isReservedAgentName(input: { name: string }): boolean {
  return RESERVED_AGENT_NAMES.has(input.name);
}
