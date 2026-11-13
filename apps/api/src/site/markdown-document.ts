export enum MarkdownBlockKind {
  Heading = 'heading',
  Paragraph = 'paragraph',
  Quote = 'quote',
  List = 'list',
  Code = 'code',
}

export type MarkdownBlock =
  | { kind: MarkdownBlockKind.Heading; level: number; text: string }
  | { kind: MarkdownBlockKind.Paragraph; text: string }
  | { kind: MarkdownBlockKind.Quote; text: string }
  | { kind: MarkdownBlockKind.List; items: string[]; isOrdered: boolean }
  | { kind: MarkdownBlockKind.Code; language: string; code: string };

export function renderMarkdown(input: { blocks: MarkdownBlock[] }): string {
  throw new Error(`renderMarkdown is not implemented for ${input.blocks.length} blocks`);
}
