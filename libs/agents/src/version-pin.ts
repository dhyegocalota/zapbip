const REGULAR_EXPRESSION_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const ESCAPED_MATCH = '\\$&';
const MULTILINE_FLAG = 'm';

function escaped(input: { text: string }): string {
  return input.text.replace(REGULAR_EXPRESSION_SPECIALS, ESCAPED_MATCH);
}

export function versionPinOf(input: { path: string; before: string; version: string; after: string }): { path: string; pattern: RegExp } {
  const { before, version, after } = input;
  const source = [before, version, after].map((text) => escaped({ text })).join('');
  return { path: input.path, pattern: new RegExp(source, MULTILINE_FLAG) };
}
