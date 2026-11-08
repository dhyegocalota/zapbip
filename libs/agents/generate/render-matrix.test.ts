import { DocsLanguage, WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AgentFacet, type AgentDefinition } from '../src/contract';
import { WAKE_RUNG_LABELS } from '../src/docs';
import { definition as fixtureDefinition } from '../testing/fixture-agent/definition';
import { renderMatrix } from './render-matrix';
import { realAgents, resolvedAgentOf } from './test-agents';

const SEPARATOR_ROW_PATTERN = /^\|[\s-|]+\|$/;
const HEADER: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Agent', 'Wake type', 'Expected delay', 'Page'],
  [DocsLanguage.PortugueseBrazil]: ['IA', 'Tipo de despertar', 'Atraso esperado', 'Página'],
};
const ROW_FOR_ONE_AGENT: Record<DocsLanguage, string[][]> = {
  [DocsLanguage.English]: [
    ['Alpha Agent', 'Local', '7 seconds', '[Alpha Agent](/agents/alpha-agent)'],
    ['Beta Agent', 'Local', 'Not measured', '[Beta Agent](/agents/beta-agent)'],
    ['Gamma Agent', 'Scheduled', '1 hour', '[Gamma Agent](/agents/gamma-agent)'],
  ],
  [DocsLanguage.PortugueseBrazil]: [
    ['Alpha Agent', 'Local', '7 segundos', '[Alpha Agent](/pt-br/agents/alpha-agent)'],
    ['Beta Agent', 'Local', 'Não medido', '[Beta Agent](/pt-br/agents/beta-agent)'],
    ['Gamma Agent', 'Agendada', '1 hora', '[Gamma Agent](/pt-br/agents/gamma-agent)'],
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

function definitionOf(input: { name: string; rung: WakeRung; expectedDelaySeconds: number | null }): AgentDefinition {
  const names = { [DocsLanguage.English]: input.name, [DocsLanguage.PortugueseBrazil]: input.name };
  return {
    ...fixtureDefinition,
    docs: { ...fixtureDefinition.docs, matrixName: names, linkName: names },
    listen: { ...fixtureDefinition.listen, rung: input.rung, expectedDelaySeconds: input.expectedDelaySeconds },
  };
}

function agentsFor(input: { ids: string[] }) {
  const definitions: Record<string, AgentDefinition> = {
    'alpha-agent': definitionOf({ name: 'Alpha Agent', rung: WakeRung.Local, expectedDelaySeconds: 7 }),
    'beta-agent': definitionOf({ name: 'Beta Agent', rung: WakeRung.Local, expectedDelaySeconds: null }),
    'gamma-agent': definitionOf({ name: 'Gamma Agent', rung: WakeRung.Scheduled, expectedDelaySeconds: 3600 }),
  };
  return input.ids.map((id) =>
    resolvedAgentOf({
      id,
      folder: `libs/agents/supported/${id}`,
      definition: definitions[id] as AgentDefinition,
      facets: [AgentFacet.Definition],
    }),
  );
}

describe('renderMatrix', () => {
  describe.each(Object.values(DocsLanguage))('in %s', (language) => {
    test('has its header and one row per agent with seconds, one hour and not measured', () => {
      const table = tableOf({
        table: renderMatrix({ agents: agentsFor({ ids: ['alpha-agent', 'beta-agent', 'gamma-agent'] }), language }),
      });
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
