import { DocsLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AgentFacet } from '../src/contract';
import { definition as fixtureDefinition } from '../testing/fixture-agent/definition';
import { planPages } from './render-pages';
import { resolvedAgentOf } from './test-agents';

const FIXTURE_FOLDER = 'libs/agents/testing/fixture-agent';
const ALL_FACETS = [AgentFacet.Definition, AgentFacet.EnglishPage, AgentFacet.PortuguesePage];
const ENGLISH_HEADINGS = ['What works', 'How it listens', 'Set up from zero', 'Check it works'];
const PORTUGUESE_HEADINGS = ['O que funciona', 'Como ela escuta', 'Configure do zero', 'Confira se funciona'];
const ENGLISH_FACT = fixtureDefinition.docs.pageFacts[DocsLanguage.English][0] as string;
const PORTUGUESE_FACT = fixtureDefinition.docs.pageFacts[DocsLanguage.PortugueseBrazil][0] as string;

function pageOf(input: { headings: string[]; fact: string }): string {
  return `---\ntitle: Fixture\ndescription: Fixture page.\n---\n\n${input.headings.map((heading) => `## ${heading}\n\n${input.fact}\n`).join('\n')}`;
}

function sourcesOf(input: { english: string; portuguese: string }): (path: string) => string {
  const sources: Record<string, string> = {
    [`${FIXTURE_FOLDER}/page.en.mdx`]: input.english,
    [`${FIXTURE_FOLDER}/page.pt-br.mdx`]: input.portuguese,
  };
  return (path) => sources[path] as string;
}

function planFor(input: { english: string; portuguese: string; facets: AgentFacet[] }) {
  const agent = resolvedAgentOf({ id: 'fixture-agent', folder: FIXTURE_FOLDER, definition: fixtureDefinition, facets: input.facets });
  return planPages({ agents: [agent], readSource: sourcesOf(input) });
}

const ENGLISH_PAGE = pageOf({ headings: ENGLISH_HEADINGS, fact: ENGLISH_FACT });
const PORTUGUESE_PAGE = pageOf({ headings: PORTUGUESE_HEADINGS, fact: PORTUGUESE_FACT });

describe('planPages', () => {
  test('copies each page of the folder to the docs, unchanged, in both languages', () => {
    const { writes, violations } = planFor({ english: ENGLISH_PAGE, portuguese: PORTUGUESE_PAGE, facets: ALL_FACETS });
    expect(violations).toEqual([]);
    expect(writes).toEqual([
      { path: 'apps/docs/agents/fixture-agent.mdx', content: ENGLISH_PAGE },
      { path: 'apps/docs/pt-br/agents/fixture-agent.mdx', content: PORTUGUESE_PAGE },
    ]);
  });

  test('reports headings out of order in pt-BR and writes only the page that is valid', () => {
    const swapped = pageOf({ headings: [...PORTUGUESE_HEADINGS].reverse(), fact: PORTUGUESE_FACT });
    const { writes, violations } = planFor({ english: ENGLISH_PAGE, portuguese: swapped, facets: ALL_FACETS });
    expect(violations).toEqual([
      `fixture-agent page.pt-br.mdx: expected ${PORTUGUESE_HEADINGS.join(' | ')} but found ${[...PORTUGUESE_HEADINGS].reverse().join(' | ')}`,
    ]);
    expect(writes.map((write) => write.path)).toEqual(['apps/docs/agents/fixture-agent.mdx']);
  });

  test('names the agent, the language and the missing page fact', () => {
    const missingFact = pageOf({ headings: ENGLISH_HEADINGS, fact: 'nothing' });
    const { violations } = planFor({ english: missingFact, portuguese: PORTUGUESE_PAGE, facets: ALL_FACETS });
    expect(violations).toEqual([`fixture-agent page.en.mdx: the page fact "${ENGLISH_FACT}" is missing`]);
  });

  test('reports a page the folder does not have and writes nothing for it', () => {
    const { writes, violations } = planFor({
      english: ENGLISH_PAGE,
      portuguese: PORTUGUESE_PAGE,
      facets: [AgentFacet.Definition, AgentFacet.EnglishPage],
    });
    expect(violations).toEqual(['fixture-agent has no page.pt-br.mdx']);
    expect(writes.map((write) => write.path)).toEqual(['apps/docs/agents/fixture-agent.mdx']);
  });
});
