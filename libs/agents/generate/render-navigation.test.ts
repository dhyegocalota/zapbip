import { describe, expect, test } from 'vitest';
import { orphanPagePathsOf, renderNavigation } from './render-navigation';
import { SAMPLE_IDS_IN_ORDER, sampleAgents } from './test-agents';

type Group = { group: string; pages: unknown[] };
type Language = { language: string; groups: Group[] };

const NAVIGATION_ORDER = [...SAMPLE_IDS_IN_ORDER].reverse();
const OTHER_GROUP = { group: 'Help', pages: ['help/about', { group: 'Nested', pages: ['x'] }] };

function sourceWith(input: { englishPages: unknown[]; portuguesePages: unknown[] }): string {
  const navigation = {
    theme: 'mint',
    colors: { primary: '#000000' },
    navigation: {
      languages: [
        { language: 'en', groups: [{ group: 'Agents', pages: input.englishPages }, OTHER_GROUP] },
        { language: 'pt-BR', groups: [{ group: 'IAs', pages: input.portuguesePages }, OTHER_GROUP] },
      ],
    },
  };
  return `${JSON.stringify(navigation, null, 2)}\n`;
}

function groupsOf(input: { content: string; language: string }): Group[] {
  const languages = JSON.parse(input.content).navigation.languages as Language[];
  return (languages.find((candidate) => candidate.language === input.language) as Language).groups;
}

const TODAY = sourceWith({
  englishPages: ['agents/supported-agents', ...NAVIGATION_ORDER.map((id) => `agents/${id}`)],
  portuguesePages: ['pt-br/agents/supported-agents', ...NAVIGATION_ORDER.map((id) => `pt-br/agents/${id}`)],
});

describe('renderNavigation', () => {
  test('lists the matrix first and the agents by wake rung, then name, in both languages', () => {
    const { content, violations } = renderNavigation({ source: TODAY, agents: sampleAgents() });
    expect(violations).toEqual([]);
    expect(groupsOf({ content, language: 'en' })[0]?.pages).toEqual([
      'agents/supported-agents',
      ...SAMPLE_IDS_IN_ORDER.map((id) => `agents/${id}`),
    ]);
    expect(groupsOf({ content, language: 'pt-BR' })[0]?.pages).toEqual([
      'pt-br/agents/supported-agents',
      ...SAMPLE_IDS_IN_ORDER.map((id) => `pt-br/agents/${id}`),
    ]);
  });

  test('leaves every other group and key byte-identical', () => {
    const agents = sampleAgents().filter((agent) => agent.id !== 'zeta-local');
    const { content } = renderNavigation({ source: TODAY, agents });
    expect(content.split('\n').filter((line) => !line.includes('agents/'))).toEqual(
      TODAY.split('\n').filter((line) => !line.includes('agents/')),
    );
    expect(content).not.toContain('agents/zeta-local');
  });

  test('names a page of another group found in the agents group', () => {
    const source = sourceWith({
      englishPages: ['agents/supported-agents', 'guides/webhook-wake'],
      portuguesePages: ['pt-br/agents/supported-agents'],
    });
    expect(renderNavigation({ source, agents: sampleAgents() }).violations).toEqual([
      'the Agents group holds guides/webhook-wake, which the generator does not own',
    ]);
  });
});

describe('orphanPagePathsOf', () => {
  test('plans the page and its pt-br twin for a page with no folder, and nothing else', () => {
    const existingPaths = [
      'apps/docs/agents/ghost.mdx',
      'apps/docs/agents/zeta-local.mdx',
      'apps/docs/agents/supported-agents.mdx',
      'apps/docs/pt-br/agents/zeta-local.mdx',
      'apps/docs/pt-br/agents/supported-agents.mdx',
    ];
    expect(orphanPagePathsOf({ existingPaths, agentIds: ['zeta-local'] })).toEqual([
      'apps/docs/agents/ghost.mdx',
      'apps/docs/pt-br/agents/ghost.mdx',
    ]);
  });

  test('finds a page that only the pt-br folder holds', () => {
    expect(orphanPagePathsOf({ existingPaths: ['apps/docs/pt-br/agents/ghost.mdx'], agentIds: [] })).toEqual([
      'apps/docs/agents/ghost.mdx',
      'apps/docs/pt-br/agents/ghost.mdx',
    ]);
  });

  test('plans nothing when every page has its folder', () => {
    expect(orphanPagePathsOf({ existingPaths: ['apps/docs/agents/zeta-local.mdx'], agentIds: ['zeta-local'] })).toEqual([]);
  });
});
