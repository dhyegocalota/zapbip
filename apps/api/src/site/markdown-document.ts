const BLOCK_SEPARATOR = '\n\n';
const LINE_SEPARATOR = '\n';
const HEADING_MARK = '#';
const QUOTE_PREFIX = '> ';
const BULLET_PREFIX = '- ';
const FENCE_CHARACTER = '`';
const FENCE_RUN_PATTERN = /`+/g;
const MINIMUM_FENCE_LENGTH = 3;

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

type BlockOf<Kind extends MarkdownBlockKind> = Extract<MarkdownBlock, { kind: Kind }>;

function fenceOf(input: { code: string }): string {
  const runLengths = Array.from(input.code.matchAll(FENCE_RUN_PATTERN), (run) => run[0].length);
  return FENCE_CHARACTER.repeat(Math.max(MINIMUM_FENCE_LENGTH, ...runLengths.map((length) => length + 1)));
}

const BLOCK_RENDERERS: { [Kind in MarkdownBlockKind]: (block: BlockOf<Kind>) => string } = {
  [MarkdownBlockKind.Heading]: (block) => `${HEADING_MARK.repeat(block.level)} ${block.text}`,
  [MarkdownBlockKind.Paragraph]: (block) => block.text,
  [MarkdownBlockKind.Quote]: (block) =>
    block.text
      .split(LINE_SEPARATOR)
      .map((line) => `${QUOTE_PREFIX}${line}`)
      .join(LINE_SEPARATOR),
  [MarkdownBlockKind.List]: (block) =>
    block.items.map((item, index) => `${block.isOrdered ? `${index + 1}. ` : BULLET_PREFIX}${item}`).join(LINE_SEPARATOR),
  [MarkdownBlockKind.Code]: (block) => {
    const fence = fenceOf({ code: block.code });
    return [`${fence}${block.language}`, block.code, fence].join(LINE_SEPARATOR);
  },
};

function renderBlock(block: MarkdownBlock): string {
  return (BLOCK_RENDERERS[block.kind] as (block: MarkdownBlock) => string)(block);
}

export function renderMarkdown(input: { blocks: MarkdownBlock[] }): string {
  if (input.blocks.length === 0) return '';
  return `${input.blocks.map(renderBlock).join(BLOCK_SEPARATOR)}${LINE_SEPARATOR}`;
}
