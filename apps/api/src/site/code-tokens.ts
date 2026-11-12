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

export function highlightCode(input: { code: string }): CodeToken[][] {
  throw new Error('highlightCode is not implemented');
}
