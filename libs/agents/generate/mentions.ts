export type MentionFile = { path: string; text: string };

const LINE_SEPARATOR = '\n';
const REGULAR_EXPRESSION_SPECIALS = /[.*+?^${}()|[\]\\]/g;

function patternOf(input: { names: string[] }): RegExp {
  const alternatives = input.names.map((name) => name.replace(REGULAR_EXPRESSION_SPECIALS, '\\$&')).join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'iu');
}

export function mentionsOf(input: { names: string[]; files: MentionFile[]; excludedPrefixes: string[] }): string[] {
  const pattern = patternOf({ names: input.names });
  return input.files
    .filter((file) => !input.excludedPrefixes.some((prefix) => file.path.startsWith(prefix)))
    .flatMap((file) => file.text.split(LINE_SEPARATOR).flatMap((line, index) => (pattern.test(line) ? [`${file.path}:${index + 1}`] : [])));
}
