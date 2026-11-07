import { describe, expect, test } from 'vitest';
import { DOCS_ROOT, readRepositoryFile } from './repository-files';

const WAKE_LADDER_PAGES = ['concepts/wake-ladder.mdx', 'pt-br/concepts/wake-ladder.mdx'];
const SET_WAKE_PAGES = ['mcp-reference/set-wake.mdx', 'pt-br/mcp-reference/set-wake.mdx'];
const ONE_HOP_PHRASES: Record<string, string> = {
  'concepts/wake-ladder.mdx': 'A standby never forwards to another standby',
  'mcp-reference/set-wake.mdx': 'A standby never forwards to another standby',
  'pt-br/concepts/wake-ladder.mdx': 'Uma reserva nunca repassa para outra reserva',
  'pt-br/mcp-reference/set-wake.mdx': 'Uma reserva nunca repassa para outra reserva',
};
const ONE_HOP_WORDS: Record<string, string> = {
  'concepts/wake-ladder.mdx': 'one hop',
  'mcp-reference/set-wake.mdx': 'one hop',
  'pt-br/concepts/wake-ladder.mdx': 'um salto',
  'pt-br/mcp-reference/set-wake.mdx': 'um salto',
};
const TOOL_FIELD_PATTERN = /mode:\s*local|"mode"|interval_minutes|standby_agent/;

function pageText(page: string): string {
  return readRepositoryFile(`${DOCS_ROOT}/${page}`);
}

describe('scheduled wake docs', () => {
  test.each([...WAKE_LADDER_PAGES, ...SET_WAKE_PAGES])('%s states the one-hop standby rule', (page) => {
    const text = pageText(page);
    expect(text).toContain(ONE_HOP_PHRASES[page]);
    expect(text).toContain(ONE_HOP_WORDS[page]);
  });

  test.each(WAKE_LADDER_PAGES)('%s names no tool field on the main path', (page) => {
    expect(pageText(page)).not.toMatch(TOOL_FIELD_PATTERN);
  });
});
