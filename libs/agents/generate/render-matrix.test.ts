import { DocsPageLanguage, WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AgentFacet, type AgentDefinition } from '../src/contract';
import { WAKE_RUNG_LABELS } from '../src/docs';
import { renderMatrix } from './render-matrix';
import { SAMPLE_IDS_IN_ORDER, resolvedAgentOf, sampleAgents, sampleDefinitionOf } from './test-agents';

const SEPARATOR_ROW_PATTERN = /^\|[\s-|]+\|$/;
const HEADER: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['Agent', 'Wake type', 'Expected delay', 'Page'],
  [DocsPageLanguage.PortugueseBrazil]: ['IA', 'Tipo de despertar', 'Atraso esperado', 'Página'],
  [DocsPageLanguage.Spanish]: ['IA', 'Tipo de activación', 'Retraso esperado', 'Página'],
  [DocsPageLanguage.German]: ['KI', 'Weckart', 'Erwartete Verzögerung', 'Seite'],
  [DocsPageLanguage.French]: ['IA', 'Type de réveil', 'Délai attendu', 'Page'],
  [DocsPageLanguage.Japanese]: ['AI', '起動方式', '想定される遅延', 'ページ'],
  [DocsPageLanguage.Korean]: ['AI', '깨우기 방식', '예상 지연', '페이지'],
  [DocsPageLanguage.Chinese]: ['AI', '唤醒方式', '预期延迟', '页面'],
};
const ROW_FOR_ONE_AGENT: Record<DocsPageLanguage, string[][]> = {
  [DocsPageLanguage.English]: [
    ['Alpha Agent', 'Local', '7 seconds', '[Alpha Agent](/agents/alpha-agent)'],
    ['Beta Agent', 'Local', 'Not measured', '[Beta Agent](/agents/beta-agent)'],
    ['Gamma Agent', 'Scheduled', '1 hour', '[Gamma Agent](/agents/gamma-agent)'],
  ],
  [DocsPageLanguage.PortugueseBrazil]: [
    ['Alpha Agent', 'Local', '7 segundos', '[Alpha Agent](/pt-br/agents/alpha-agent)'],
    ['Beta Agent', 'Local', 'Não medido', '[Beta Agent](/pt-br/agents/beta-agent)'],
    ['Gamma Agent', 'Agendada', '1 hora', '[Gamma Agent](/pt-br/agents/gamma-agent)'],
  ],
  [DocsPageLanguage.Spanish]: [
    ['Alpha Agent', 'Local', '7 segundos', '[Alpha Agent](/es/agents/alpha-agent)'],
    ['Beta Agent', 'Local', 'Sin medir', '[Beta Agent](/es/agents/beta-agent)'],
    ['Gamma Agent', 'Programado', '1 hora', '[Gamma Agent](/es/agents/gamma-agent)'],
  ],
  [DocsPageLanguage.German]: [
    ['Alpha Agent', 'Lokal', '7 Sekunden', '[Alpha Agent](/de/agents/alpha-agent)'],
    ['Beta Agent', 'Lokal', 'Nicht gemessen', '[Beta Agent](/de/agents/beta-agent)'],
    ['Gamma Agent', 'Geplant', '1 Stunde', '[Gamma Agent](/de/agents/gamma-agent)'],
  ],
  [DocsPageLanguage.French]: [
    ['Alpha Agent', 'Local', '7\u00a0secondes', '[Alpha Agent](/fr/agents/alpha-agent)'],
    ['Beta Agent', 'Local', 'Non mesuré', '[Beta Agent](/fr/agents/beta-agent)'],
    ['Gamma Agent', 'Planifié', '1\u00a0heure', '[Gamma Agent](/fr/agents/gamma-agent)'],
  ],
  [DocsPageLanguage.Japanese]: [
    ['Alpha Agent', 'ローカル', '7 秒', '[Alpha Agent](/ja/agents/alpha-agent)'],
    ['Beta Agent', 'ローカル', '未計測', '[Beta Agent](/ja/agents/beta-agent)'],
    ['Gamma Agent', 'スケジュール', '1 時間', '[Gamma Agent](/ja/agents/gamma-agent)'],
  ],
  [DocsPageLanguage.Korean]: [
    ['Alpha Agent', '로컬', '7초', '[Alpha Agent](/ko/agents/alpha-agent)'],
    ['Beta Agent', '로컬', '측정 안 됨', '[Beta Agent](/ko/agents/beta-agent)'],
    ['Gamma Agent', '예약', '1시간', '[Gamma Agent](/ko/agents/gamma-agent)'],
  ],
  [DocsPageLanguage.Chinese]: [
    ['Alpha Agent', '本地', '7秒钟', '[Alpha Agent](/zh/agents/alpha-agent)'],
    ['Beta Agent', '本地', '未测量', '[Beta Agent](/zh/agents/beta-agent)'],
    ['Gamma Agent', '定时', '1小时', '[Gamma Agent](/zh/agents/gamma-agent)'],
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
  const definitions: Record<string, AgentDefinition> = {
    'alpha-agent': sampleDefinitionOf({ name: 'Alpha Agent', rung: WakeRung.Local, expectedDelaySeconds: 7 }),
    'beta-agent': sampleDefinitionOf({ name: 'Beta Agent', rung: WakeRung.Local, expectedDelaySeconds: null }),
    'gamma-agent': sampleDefinitionOf({ name: 'Gamma Agent', rung: WakeRung.Scheduled, expectedDelaySeconds: 3600 }),
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
  describe.each(Object.values(DocsPageLanguage))('in %s', (language) => {
    test('has its header and one row per agent with seconds, one hour and not measured', () => {
      const table = tableOf({
        table: renderMatrix({ agents: agentsFor({ ids: ['alpha-agent', 'beta-agent', 'gamma-agent'] }), language }),
      });
      expect(table).toEqual([HEADER[language], ...ROW_FOR_ONE_AGENT[language]]);
    });

    test('takes the rung cell from the rung labels', () => {
      const agents = sampleAgents();
      const rungCells = tableOf({ table: renderMatrix({ agents, language }) })
        .slice(1)
        .map((cells) => cells[1]);
      const rungLabels = Object.values(WAKE_RUNG_LABELS[language]);
      expect(rungCells.every((cell) => rungLabels.includes(cell as string))).toBe(true);
    });

    test('lists the agents in the matrix order', () => {
      const table = tableOf({ table: renderMatrix({ agents: sampleAgents(), language }) });
      expect(table).toHaveLength(SAMPLE_IDS_IN_ORDER.length + 1);
      expect(table.slice(1).map((cells) => cells[0])).toEqual([
        'Alpha Local',
        'Zeta Local',
        'Beta Webhook',
        'Gamma Scheduled',
        'Delta Standby',
        'Epsilon Inbox',
      ]);
      expect(table.at(-1)?.[3]).toContain('epsilon-inbox');
    });
  });
});
