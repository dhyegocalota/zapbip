import { DocsLanguage } from '@zapbip/types';
import { AGENTS_DIRECTORY, agentPagePathOf, twinPathOf } from '../src/docs';
import { MATRIX_PAGE_NAME } from '../src/checks/registry';
import { orderedAgentsOf, type ResolvedAgent } from './agent';
import { DOCS_PAGES_ROOT, PAGE_DIRECTORIES } from './paths';

export type RenderedNavigation = { content: string; violations: string[] };

type NavigationLanguage = { language: string; groups: { group: string; pages: unknown[] }[] };

const NAVIGATION_GROUPS: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'Agents',
  [DocsLanguage.PortugueseBrazil]: 'IAs',
};
const OWNED_PAGE_PATTERN = new RegExp(`^(?:pt-br/)?${AGENTS_DIRECTORY}/[a-z0-9-]+$`);
const PAGE_EXTENSION = '.mdx';
const ORPHAN_PATH_PATTERN = new RegExp(`^${DOCS_PAGES_ROOT}/(?:pt-br/)?${AGENTS_DIRECTORY}/([a-z0-9-]+)\\${PAGE_EXTENSION}$`);

function pagesOf(input: { source: string; language: DocsLanguage }): unknown[] {
  const languages = JSON.parse(input.source).navigation.languages as NavigationLanguage[];
  const entry = languages.find((candidate) => candidate.language === input.language);
  if (!entry) throw new Error(`docs.json has no navigation for ${input.language}`);
  const group = entry.groups.find((candidate) => candidate.group === NAVIGATION_GROUPS[input.language]);
  if (!group) throw new Error(`docs.json has no ${NAVIGATION_GROUPS[input.language]} group`);
  return group.pages;
}

function replacePages(input: { source: string; language: DocsLanguage; pages: string[] }): string {
  const group = NAVIGATION_GROUPS[input.language];
  const pattern = new RegExp(`("group": "${group}",(\\s*)"pages": )\\[[^\\]]*\\]`);
  if (!pattern.test(input.source)) throw new Error(`docs.json has no ${group} pages list to rewrite`);
  return input.source.replace(pattern, (_whole, head: string, spacing: string) => {
    const indent = spacing.slice(spacing.lastIndexOf('\n') + 1);
    const lines = input.pages.map((page) => `${indent}  ${JSON.stringify(page)}`);
    return `${head}[\n${lines.join(',\n')}\n${indent}]`;
  });
}

function foreignPagesViolationsOf(input: { source: string; language: DocsLanguage }): string[] {
  return pagesOf(input)
    .filter((page) => typeof page !== 'string' || !OWNED_PAGE_PATTERN.test(page))
    .map((page) => `the ${NAVIGATION_GROUPS[input.language]} group holds ${String(page)}, which the generator does not own`);
}

export function renderNavigation(input: { source: string; agents: ResolvedAgent[] }): RenderedNavigation {
  const languages = Object.values(DocsLanguage);
  const violations = languages.flatMap((language) => foreignPagesViolationsOf({ source: input.source, language }));
  if (violations.length > 0) return { content: input.source, violations };
  const orderedAgents = orderedAgentsOf({ agents: input.agents });
  const content = languages.reduce((source, language) => {
    const matrixPage = twinPathOf({ path: `${AGENTS_DIRECTORY}/${MATRIX_PAGE_NAME}`, language });
    const agentPages = orderedAgents.map((agent) => agentPagePathOf({ client: agent.id, language }));
    return replacePages({ source, language, pages: [matrixPage, ...agentPages] });
  }, input.source);
  return { content, violations: [] };
}

export function orphanPagePathsOf(input: { existingPaths: string[]; agentIds: string[] }): string[] {
  const orphanSlugs = [
    ...new Set(
      input.existingPaths
        .map((path) => ORPHAN_PATH_PATTERN.exec(path)?.[1])
        .filter((slug): slug is string => slug !== undefined && slug !== MATRIX_PAGE_NAME && !input.agentIds.includes(slug)),
    ),
  ];
  return orphanSlugs.flatMap((slug) => Object.values(PAGE_DIRECTORIES).map((directory) => `${directory}/${slug}${PAGE_EXTENSION}`));
}
