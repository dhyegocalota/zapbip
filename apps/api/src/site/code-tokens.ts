export enum CodeTokenKind {
  Command = 'command',
  Flag = 'flag',
  Key = 'key',
  String = 'string',
  Table = 'table',
  Placeholder = 'placeholder',
  Plain = 'plain',
  Space = 'space',
}

export type CodeToken = { kind: CodeTokenKind; text: string };

const LINE_SEPARATOR = '\n';
const TOKEN_PATTERN = /<[^<>\s]+>|"[^"<]*"|"|--?[A-Za-z][\w-]*|\[[^\]]+\]|[A-Za-z_][\w.-]*(?=\s*[=:])|\s+|[^\s"<]+|./g;
const PLACEHOLDER_PATTERN = /^<[^<>\s]+>$/;
const FLAG_PATTERN = /^--?[A-Za-z]/;
const TABLE_PATTERN = /^\[.+\]$/;
const KEY_PATTERN = /^[A-Za-z_][\w.-]*$/;
const SEPARATOR_PATTERN = /^[=:]$/;
const SPACE_PATTERN = /^\s+$/;
const QUOTE = '"';

function kindOf(input: { text: string; isKey: boolean }): CodeTokenKind {
  const { text, isKey } = input;
  if (SPACE_PATTERN.test(text)) return CodeTokenKind.Space;
  if (PLACEHOLDER_PATTERN.test(text)) return CodeTokenKind.Placeholder;
  if (text.startsWith(QUOTE)) return CodeTokenKind.String;
  if (FLAG_PATTERN.test(text)) return CodeTokenKind.Flag;
  if (TABLE_PATTERN.test(text)) return CodeTokenKind.Table;
  if (isKey && KEY_PATTERN.test(text)) return CodeTokenKind.Key;
  return CodeTokenKind.Plain;
}

function lineTokensOf(input: { line: string }): CodeToken[] {
  const texts = Array.from(input.line.matchAll(TOKEN_PATTERN), (match) => match[0]);
  const tokens = texts.map((text, index) => {
    const following = texts.slice(index + 1).find((candidate) => !SPACE_PATTERN.test(candidate));
    const isKey = following !== undefined && SEPARATOR_PATTERN.test(following);
    return { kind: kindOf({ text, isKey }), text };
  });
  const isShellLine = tokens.every(
    (token) => token.kind !== CodeTokenKind.Key && token.kind !== CodeTokenKind.Table && !SEPARATOR_PATTERN.test(token.text),
  );
  const firstIndex = tokens.findIndex((token) => token.kind !== CodeTokenKind.Space);
  if (!isShellLine || firstIndex === -1 || tokens[firstIndex]!.kind !== CodeTokenKind.Plain) return tokens;
  return tokens.map((token, index) => (index === firstIndex ? { ...token, kind: CodeTokenKind.Command } : token));
}

export function highlightCode(input: { code: string }): CodeToken[][] {
  return input.code.split(LINE_SEPARATOR).map((line) => lineTokensOf({ line }));
}
