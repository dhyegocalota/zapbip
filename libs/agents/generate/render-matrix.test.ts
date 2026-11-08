import { DocsLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { definition as chatgptDefinition } from '../supported/chatgpt/definition';
import { definition as claudeCodeDefinition } from '../supported/claude-code/definition';
import { definition as cursorDefinition } from '../supported/cursor/definition';
import { AgentFacet } from '../src/contract';
import { WAKE_RUNG_LABELS } from '../src/docs';
import { renderMatrix } from './render-matrix';
import { realAgents, resolvedAgentOf } from './test-agents';

const SEPARATOR_ROW_PATTERN = /^\|[\s-|]+\|$/;
const HEADER: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Agent', 'Wake type', 'Expected delay', 'Page'],
  [DocsLanguage.PortugueseBrazil]: ['IA', 'Tipo de despertar', 'Atraso esperado', 'Página'],
};
const ROW_FOR_ONE_AGENT: Record<DocsLanguage, string[][]> = {
  [DocsLanguage.English]: [
    ['Claude Code', 'Local', '7 seconds', '[Claude Code](/agents/claude-code)'],
    ['Cursor', 'Local', 'Not measured', '[Cursor](/agents/cursor)'],
    ['ChatGPT', 'Scheduled', '1 hour', '[ChatGPT](/agents/chatgpt)'],
  ],
  [DocsLanguage.PortugueseBrazil]: [
    ['Claude Code', 'Local', '7 segundos', '[Claude Code](/pt-br/agents/claude-code)'],
    ['Cursor', 'Local', 'Não medido', '[Cursor](/pt-br/agents/cursor)'],
    ['ChatGPT', 'Agendada', '1 hora', '[ChatGPT](/pt-br/agents/chatgpt)'],
  ],
};

function cellsOf(input: { line: string }): string[] {
  return input.line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function tableOf(input: { table: string }): string[][] {
  return input.table
    .split('\n')
    .filter((line) => line.startsWith('|') && !SEPARATOR_ROW_PATTERN.test(line))
    .map((line) => cellsOf({ line }));
}

function agentsFor(input: { ids: string[] }) {
  const definitions = { 'claude-code': claudeCodeDefinition, chatgpt: chatgptDefinition, cursor: cursorDefinition };
  return input.ids.map((id) =>
    resolvedAgentOf({
      id,
      folder: `libs/agents/supported/${id}`,
      definition: definitions[id as keyof typeof definitions],
      facets: [AgentFacet.Definition],
    }),
  );
}

describe('renderMatrix', () => {
  describe.each(Object.values(DocsLanguage))('in %s', (language) => {
    test('has its header and one row per agent with seconds, one hour and not measured', () => {
      const table = tableOf({ table: renderMatrix({ agents: agentsFor({ ids: ['claude-code', 'chatgpt', 'cursor'] }), language }) });
      expect(table).toEqual([HEADER[language], ...ROW_FOR_ONE_AGENT[language]]);
    });

    test('takes the rung cell from the rung labels', async () => {
      const agents = await realAgents();
      const rungCells = tableOf({ table: renderMatrix({ agents, language }) })
        .slice(1)
        .map((cells) => cells[1]);
      const rungLabels = Object.values(WAKE_RUNG_LABELS[language]);
      expect(rungCells.every((cell) => rungLabels.includes(cell as string))).toBe(true);
    });

    test('lists the eleven agents in the matrix order', async () => {
      const table = tableOf({ table: renderMatrix({ agents: await realAgents(), language }) });
      expect(table).toHaveLength(12);
      expect(table[1]?.[0]).toBe('Claude Code');
      expect(table.at(-1)?.[3]).toContain('any-mcp-client');
    });
  });
});
