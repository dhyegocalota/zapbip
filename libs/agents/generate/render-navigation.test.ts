import { DocsPageLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENTS_DIRECTORY, AGENTS_GROUP_INDEX, DOCS_GROUPS, agentPagePathOf, twinPathOf } from '../src/docs';
import { listedAgentSlugsOf, orphanPagesOf, renderNavigation } from './render-navigation';
import { SAMPLE_IDS_IN_ORDER, sampleAgents } from './test-agents';

type Group = { group: string; pages: unknown[] };
type Language = { language: string; groups: Group[] };

const LANGUAGES = Object.values(DocsPageLanguage);
const AGENTS_GROUP_OF = Object.fromEntries(LANGUAGES.map((language) => [language, DOCS_GROUPS[language][AGENTS_GROUP_INDEX]])) as Record<
  DocsPageLanguage,
  string
>;
const MATRIX_PAGE = `${AGENTS_DIRECTORY}/supported-agents`;
const NAVIGATION_ORDER = [...SAMPLE_IDS_IN_ORDER].reverse();
const OTHER_GROUP = { group: 'Help', pages: ['help/faq', { group: 'Nested', pages: ['x'] }] };

function sourceWith(input: { pagesOf: (language: DocsPageLanguage) => unknown[] }): string {
  const navigation = {
    theme: 'mint',
    colors: { primary: '#000000' },
    navigation: {
      languages: LANGUAGES.map((language) => ({
        language,
        groups: [{ group: AGENTS_GROUP_OF[language], pages: input.pagesOf(language) }, OTHER_GROUP],
      })),
    },
  };
  return `${JSON.stringify(navigation, null, 2)}\n`;
}

function groupsOf(input: { content: string; language: string }): Group[] {
  const languages = JSON.parse(input.content).navigation.languages as Language[];
  return (languages.find((candidate) => candidate.language === input.language) as Language).groups;
}

const TODAY = sourceWith({
  pagesOf: (language) => [
    twinPathOf({ path: MATRIX_PAGE, language }),
    ...NAVIGATION_ORDER.map((id) => agentPagePathOf({ client: id, language })),
  ],
});

describe('renderNavigation', () => {
  test.each(LANGUAGES)('lists the matrix first and the agents by wake rung, then name, in %s', (language) => {
    const { content, violations } = renderNavigation({ source: TODAY, agents: sampleAgents() });
    expect(violations).toEqual([]);
    expect(groupsOf({ content, language })[0]?.pages).toEqual([
      twinPathOf({ path: MATRIX_PAGE, language }),
      ...SAMPLE_IDS_IN_ORDER.map((id) => agentPagePathOf({ client: id, language })),
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

  test.each(LANGUAGES)('names a page of another group found in the %s agents group', (language) => {
    const source = sourceWith({
      pagesOf: (candidate) =>
        candidate === language
          ? [twinPathOf({ path: MATRIX_PAGE, language }), 'guides/webhook-wake']
          : [twinPathOf({ path: MATRIX_PAGE, language: candidate })],
    });
    expect(renderNavigation({ source, agents: sampleAgents() }).violations).toEqual([
      `the ${AGENTS_GROUP_OF[language]} group holds guides/webhook-wake, which the generator does not own`,
    ]);
  });
});

describe('orphanPagesOf', () => {
  const existingPaths = [
    'apps/docs/agents/ghost.mdx',
    'apps/docs/agents/zeta-local.mdx',
    'apps/docs/agents/supported-agents.mdx',
    'apps/docs/pt-br/agents/zeta-local.mdx',
    'apps/docs/pt-br/agents/supported-agents.mdx',
    'apps/docs/ja/agents/zeta-local.mdx',
  ];
  const everyLanguageDeletionsOf = (slug: string): string[] =>
    LANGUAGES.map((language) => `apps/docs/${twinPathOf({ path: `${AGENTS_DIRECTORY}/${slug}`, language })}.mdx`).sort();

  test('plans the page and its twin in every language for a listed page with no folder, and nothing else', () => {
    const plan = orphanPagesOf({ existingPaths, agentIds: ['zeta-local'], listedSlugs: ['ghost', 'zeta-local'] });
    expect({ deletions: [...plan.deletions].sort(), violations: plan.violations }).toEqual({
      deletions: everyLanguageDeletionsOf('ghost'),
      violations: [],
    });
  });

  test('refuses a page that is neither an agent folder nor listed, and deletes nothing', () => {
    expect(orphanPagesOf({ existingPaths, agentIds: ['zeta-local'], listedSlugs: ['zeta-local'] })).toEqual({
      deletions: [],
      violations: ['agents/ghost has no agent folder and is not in the Agents lists: the generator does not delete a hand-written page'],
    });
  });

  test.each(LANGUAGES.filter((language) => language !== DocsPageLanguage.English))(
    'finds a listed page that only the %s folder holds',
    (language) => {
      const path = `apps/docs/${twinPathOf({ path: `${AGENTS_DIRECTORY}/ghost`, language })}.mdx`;
      const result = orphanPagesOf({ existingPaths: [path], agentIds: [], listedSlugs: ['ghost'] });
      expect([...result.deletions].sort()).toEqual(everyLanguageDeletionsOf('ghost'));
    },
  );

  test('plans nothing when every page has its folder', () => {
    expect(orphanPagesOf({ existingPaths: ['apps/docs/agents/zeta-local.mdx'], agentIds: ['zeta-local'], listedSlugs: [] })).toEqual({
      deletions: [],
      violations: [],
    });
  });
});

describe('listedAgentSlugsOf', () => {
  test('lists the agent pages of every language once, without the matrix page', () => {
    expect(listedAgentSlugsOf({ source: TODAY })).toContain('zeta-local');
    expect(listedAgentSlugsOf({ source: TODAY }).filter((slug) => slug === 'zeta-local')).toHaveLength(1);
  });
});
