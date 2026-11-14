import { DocsPageLanguage } from '@zapbip/types';
import { pageRuleViolationsOf } from '../src/checks/pages';
import { PAGE_FACETS } from '../src/contract';
import { AGENT_PAGE_HEADINGS, AGENT_PAGE_SECTIONS, agentPagePathOf } from '../src/docs';
import type { ResolvedAgent } from './agent';
import { DOCS_PAGES_ROOT } from './paths';
import type { GeneratedFile } from './plan';

export type PlannedPages = { writes: GeneratedFile[]; violations: string[] };

const HEADING_PATTERN = /^## (.+)$/gm;
const HEADING_SEPARATOR = ' | ';
const PAGE_EXTENSION = '.mdx';

function headingsOf(input: { page: string; expected: string[] }): string[] {
  return [...input.page.matchAll(HEADING_PATTERN)].map((match) => match[1] as string).filter((heading) => input.expected.includes(heading));
}

function pageViolationsOf(input: { agent: ResolvedAgent; language: DocsPageLanguage; page: string }): string[] {
  const label = `${input.agent.id} ${PAGE_FACETS[input.language]}`;
  const expected = AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[input.language][section]);
  const found = headingsOf({ page: input.page, expected });
  const headingViolations =
    found.join(HEADING_SEPARATOR) === expected.join(HEADING_SEPARATOR)
      ? []
      : [`${label}: expected ${expected.join(HEADING_SEPARATOR)} but found ${found.join(HEADING_SEPARATOR)}`];
  const factViolations = input.agent.definition.docs.pageFacts[input.language]
    .filter((fact) => !input.page.includes(fact))
    .map((fact) => `${label}: the page fact "${fact}" is missing`);
  const ruleViolations = pageRuleViolationsOf({
    label,
    language: input.language,
    page: input.page,
    hasInstall: input.agent.install !== null,
    plugin: input.agent.plugin,
  });
  return [...headingViolations, ...factViolations, ...ruleViolations];
}

function planPage(input: { agent: ResolvedAgent; language: DocsPageLanguage; readSource: (path: string) => string }): {
  writes: GeneratedFile[];
  violations: string[];
} {
  const facet = PAGE_FACETS[input.language];
  if (!input.agent.facets.includes(facet)) return { writes: [], violations: [`${input.agent.id} has no ${facet}`] };
  const page = input.readSource(`${input.agent.folder}/${facet}`);
  const violations = pageViolationsOf({ agent: input.agent, language: input.language, page });
  if (violations.length > 0) return { writes: [], violations };
  const path = `${DOCS_PAGES_ROOT}/${agentPagePathOf({ client: input.agent.id, language: input.language })}${PAGE_EXTENSION}`;
  return { writes: [{ path, content: page }], violations: [] };
}

export function planPages(input: { agents: ResolvedAgent[]; readSource: (path: string) => string }): PlannedPages {
  const planned = input.agents.flatMap((agent) =>
    Object.values(DocsPageLanguage).map((language) => planPage({ agent, language, readSource: input.readSource })),
  );
  return { writes: planned.flatMap((entry) => entry.writes), violations: planned.flatMap((entry) => entry.violations) };
}
