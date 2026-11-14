import { DocsPageLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AgentFacet, PAGE_FACETS } from '../src/contract';
import { AGENT_PAGE_HEADINGS, AGENT_PAGE_SECTIONS, perLanguage, twinPathOf } from '../src/docs';
import { definition as fixtureDefinition } from '../testing/fixture-agent/definition';
import { planPages } from './render-pages';
import { resolvedAgentOf } from './test-agents';

const FIXTURE_FOLDER = 'libs/agents/testing/fixture-agent';
const DOCS_ROOT = 'apps/docs';
const LANGUAGES = Object.values(DocsPageLanguage);
const ALL_FACETS = [AgentFacet.Definition, ...LANGUAGES.map((language) => PAGE_FACETS[language])];
const NOT_ENGLISH_LANGUAGES = LANGUAGES.filter((language) => language !== DocsPageLanguage.English);

function headingsOf(input: { language: DocsPageLanguage }): string[] {
  return AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[input.language][section]);
}

function factOf(input: { language: DocsPageLanguage }): string {
  return fixtureDefinition.docs.pageFacts[input.language][0] as string;
}

function pageOf(input: { headings: string[]; fact: string }): string {
  return `---\ntitle: Fixture\ndescription: Fixture page.\n---\n\nimport { Chat } from '/snippets/chat.jsx';\n\n${input.headings.map((heading) => `## ${heading}\n\n${input.fact}\n`).join('\n')}\n<Chat messages={[{ name: 'Fixture', text: 'Hello', time: '14:03' }]} />\n`;
}

function validPageOf(input: { language: DocsPageLanguage }): string {
  return pageOf({ headings: headingsOf(input), fact: factOf(input) });
}

function sourcesOf(input: { pages: Record<DocsPageLanguage, string> }): (path: string) => string {
  const sources = Object.fromEntries(LANGUAGES.map((language) => [`${FIXTURE_FOLDER}/${PAGE_FACETS[language]}`, input.pages[language]]));
  return (path) => sources[path] as string;
}

function planFor(input: { pages: Record<DocsPageLanguage, string>; facets: AgentFacet[] }) {
  const agent = resolvedAgentOf({ id: 'fixture-agent', folder: FIXTURE_FOLDER, definition: fixtureDefinition, facets: input.facets });
  return planPages({ agents: [agent], readSource: sourcesOf(input) });
}

const VALID_PAGES = perLanguage({ valueOf: (language) => validPageOf({ language }) });

describe('planPages', () => {
  test('copies each page of the folder to the docs, unchanged, in every language', () => {
    const { writes, violations } = planFor({ pages: VALID_PAGES, facets: ALL_FACETS });
    expect(violations).toEqual([]);
    expect(writes).toEqual(
      LANGUAGES.map((language) => ({
        path: `${DOCS_ROOT}/${twinPathOf({ path: 'agents/fixture-agent', language })}.mdx`,
        content: VALID_PAGES[language],
      })),
    );
  });

  test.each(NOT_ENGLISH_LANGUAGES)('reports headings out of order in %s and writes only the pages that are valid', (language) => {
    const headings = headingsOf({ language });
    const swapped = pageOf({ headings: [...headings].reverse(), fact: factOf({ language }) });
    const { writes, violations } = planFor({ pages: { ...VALID_PAGES, [language]: swapped }, facets: ALL_FACETS });
    expect(violations).toEqual([
      `fixture-agent ${PAGE_FACETS[language]}: expected ${headings.join(' | ')} but found ${[...headings].reverse().join(' | ')}`,
    ]);
    expect(writes).toHaveLength(LANGUAGES.length - 1);
    expect(writes.map((write) => write.path)).not.toContain(`${DOCS_ROOT}/${twinPathOf({ path: 'agents/fixture-agent', language })}.mdx`);
  });

  test.each(LANGUAGES)('names the agent, the language and the missing page fact in %s', (language) => {
    const missingFact = pageOf({ headings: headingsOf({ language }), fact: 'nothing' });
    const { violations } = planFor({ pages: { ...VALID_PAGES, [language]: missingFact }, facets: ALL_FACETS });
    expect(violations).toEqual([`fixture-agent ${PAGE_FACETS[language]}: the page fact "${factOf({ language })}" is missing`]);
  });

  test.each(NOT_ENGLISH_LANGUAGES)('reports the %s page the folder does not have and writes nothing for it', (language) => {
    const facets = ALL_FACETS.filter((facet) => facet !== PAGE_FACETS[language]);
    const { writes, violations } = planFor({ pages: VALID_PAGES, facets });
    expect(violations).toEqual([`fixture-agent has no ${PAGE_FACETS[language]}`]);
    expect(writes).toHaveLength(LANGUAGES.length - 1);
  });
});
