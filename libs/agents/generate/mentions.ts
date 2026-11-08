export type MentionFile = { path: string; text: string };

export function mentionsOf(input: { names: string[]; files: MentionFile[]; excludedPrefixes: string[] }): string[] {
  throw new Error(`mentionsOf is not implemented for ${input.names.length} names`);
}
