import { describe, expect, it } from 'vitest';
import { prefersMarkdown } from '../../src/site/markdown-negotiation';

describe('prefersMarkdown', () => {
  it.each([
    ['text/markdown'],
    ['text/markdown, text/html;q=0.9'],
    ['text/markdown, */*;q=0.1'],
    ['text/*;q=0.2, text/markdown'],
    ['TEXT/Markdown'],
  ])('says yes to %s', (accept) => {
    expect(prefersMarkdown({ accept })).toBe(true);
  });

  it.each([
    [undefined],
    [''],
    ['*/*'],
    ['text/html'],
    ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'],
    ['text/markdown;q=0.1, text/html;q=0.9'],
    ['text/markdown, text/html'],
    ['application/json'],
    ['text/markdown;q=0'],
  ])('says no to %s', (accept) => {
    expect(prefersMarkdown({ accept })).toBe(false);
  });
});
