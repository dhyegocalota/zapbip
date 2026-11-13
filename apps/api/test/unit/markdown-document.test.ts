import { describe, expect, it } from 'vitest';
import { type MarkdownBlock, MarkdownBlockKind, renderMarkdown } from '../../src/site/markdown-document';

const HEADING_LEVEL = 2;

function rendered(input: { blocks: MarkdownBlock[] }): string {
  return renderMarkdown(input);
}

describe('renderMarkdown', () => {
  it('writes a heading with its level, a paragraph and a quote', () => {
    const blocks: MarkdownBlock[] = [
      { kind: MarkdownBlockKind.Heading, level: 1, text: 'Title' },
      { kind: MarkdownBlockKind.Quote, text: 'Summary' },
      { kind: MarkdownBlockKind.Heading, level: HEADING_LEVEL, text: 'Section' },
      { kind: MarkdownBlockKind.Paragraph, text: 'Body' },
    ];
    expect(rendered({ blocks })).toBe('# Title\n\n> Summary\n\n## Section\n\nBody\n');
  });

  it('writes bullet and numbered lists', () => {
    const blocks: MarkdownBlock[] = [
      { kind: MarkdownBlockKind.List, items: ['one', 'two'], isOrdered: false },
      { kind: MarkdownBlockKind.List, items: ['first', 'second'], isOrdered: true },
    ];
    expect(rendered({ blocks })).toBe('- one\n- two\n\n1. first\n2. second\n');
  });

  it('fences code with its language', () => {
    const blocks: MarkdownBlock[] = [{ kind: MarkdownBlockKind.Code, language: 'bash', code: 'echo hi' }];
    expect(rendered({ blocks })).toBe('```bash\necho hi\n```\n');
  });

  it('fences code longer than any run of backticks inside it', () => {
    const blocks: MarkdownBlock[] = [{ kind: MarkdownBlockKind.Code, language: '', code: 'a ``` b' }];
    expect(rendered({ blocks })).toBe('````\na ``` b\n````\n');
  });

  it('keeps a multi-line quote quoted on every line', () => {
    const blocks: MarkdownBlock[] = [{ kind: MarkdownBlockKind.Quote, text: 'one\ntwo' }];
    expect(rendered({ blocks })).toBe('> one\n> two\n');
  });

  it('writes nothing for no blocks and no stray blank lines', () => {
    expect(rendered({ blocks: [] })).toBe('');
  });
});
