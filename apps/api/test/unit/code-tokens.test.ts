import { describe, expect, it } from 'vitest';
import { CodeTokenKind, highlightCode, type CodeToken } from '../../src/site/code-tokens';

function significant(input: { line: CodeToken[] }): [CodeTokenKind, string][] {
  return input.line.filter((token) => token.kind !== CodeTokenKind.Space).map((token) => [token.kind, token.text]);
}

describe('highlightCode', () => {
  it('marks the command, the flags and the placeholder of a shell line', () => {
    const [line] = highlightCode({ code: 'tool mcp add --transport http --scope user name <your-link>' });
    expect(significant({ line: line! })).toEqual([
      [CodeTokenKind.Command, 'tool'],
      [CodeTokenKind.Plain, 'mcp'],
      [CodeTokenKind.Plain, 'add'],
      [CodeTokenKind.Flag, '--transport'],
      [CodeTokenKind.Plain, 'http'],
      [CodeTokenKind.Flag, '--scope'],
      [CodeTokenKind.Plain, 'user'],
      [CodeTokenKind.Plain, 'name'],
      [CodeTokenKind.Placeholder, '<your-link>'],
    ]);
  });

  it('marks a table header, a key and a string with its placeholder', () => {
    const lines = highlightCode({ code: '[servers.demo]\nurl = "<seu-link>"' });
    expect(significant({ line: lines[0]! })).toEqual([[CodeTokenKind.Table, '[servers.demo]']]);
    expect(significant({ line: lines[1]! })).toEqual([
      [CodeTokenKind.Key, 'url'],
      [CodeTokenKind.Plain, '='],
      [CodeTokenKind.String, '"'],
      [CodeTokenKind.Placeholder, '<seu-link>'],
      [CodeTokenKind.String, '"'],
    ]);
  });

  it('marks a key before a colon and a quoted value', () => {
    const [line] = highlightCode({ code: 'transport: "plain-value"' });
    expect(significant({ line: line! })).toEqual([
      [CodeTokenKind.Key, 'transport'],
      [CodeTokenKind.Plain, ':'],
      [CodeTokenKind.String, '"plain-value"'],
    ]);
  });

  it('shows a lone placeholder as a placeholder, not a command', () => {
    const [line] = highlightCode({ code: '<your-link>' });
    expect(significant({ line: line! })).toEqual([[CodeTokenKind.Placeholder, '<your-link>']]);
  });

  it.each(['tool mcp add --x y <your-link>', '[a.b]\nurl = "<your-link>"', 'a:   "b"\n  c: d', '', 'two  spaces'])(
    'gives the code back unchanged for %j',
    (code) => {
      const lines = highlightCode({ code });
      expect(lines.map((line) => line.map((token) => token.text).join('')).join('\n')).toBe(code);
    },
  );
});
