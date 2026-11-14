import { DOCS_LANGUAGE_FOLDERS, DocsPageLanguage } from '@zapbip/types';
import { AGENTS_DIRECTORY, AGENTS_GROUP_INDEX, DOCS_GROUPS, agentPagePathOf, perLanguage, twinPathOf } from '../src/docs';
import { MATRIX_PAGE_NAME } from '../src/checks/registry';
import { orderedAgentsOf, type ResolvedAgent } from './agent';
import { DOCS_PAGES_ROOT, PAGE_DIRECTORIES } from './paths';

export type RenderedNavigation = { content: string; violations: string[] };

type NavigationLanguage = { language: string; groups: { group: string; pages: unknown[] }[] };

const NAVIGATION_GROUPS = perLanguage({ valueOf: (language) => DOCS_GROUPS[language][AGENTS_GROUP_INDEX] as string });
const FOLDER_ALTERNATIVES = Object.values(DOCS_LANGUAGE_FOLDERS)
  .filter((folder) => folder !== '')
  .join('|');
const OWNED_PAGE_PATTERN = new RegExp(`^(?:(?:${FOLDER_ALTERNATIVES})/)?${AGENTS_DIRECTORY}/[a-z0-9-]+$`);
const PAGE_EXTENSION = '.mdx';
const ORPHAN_PATH_PATTERN = new RegExp(
  `^${DOCS_PAGES_ROOT}/(?:(?:${FOLDER_ALTERNATIVES})/)?${AGENTS_DIRECTORY}/([a-z0-9-]+)\\${PAGE_EXTENSION}$`,
);

function pagesOf(input: { source: string; language: DocsPageLanguage }): unknown[] {
  const languages = JSON.parse(input.source).navigation.languages as NavigationLanguage[];
  const entry = languages.find((candidate) => candidate.language === input.language);
  if (!entry) throw new Error(`docs.json has no navigation for ${input.language}`);
  const group = entry.groups.find((candidate) => candidate.group === NAVIGATION_GROUPS[input.language]);
  if (!group) throw new Error(`docs.json has no ${NAVIGATION_GROUPS[input.language]} group`);
  return group.pages;
}

function replacePages(input: { source: string; language: DocsPageLanguage; pages: string[] }): string {
  const group = NAVIGATION_GROUPS[input.language];
  const languageStart = input.source.indexOf(`"language": "${input.language}"`);
  const before = input.source.slice(0, languageStart);
  const after = input.source.slice(languageStart);
  const pattern = new RegExp(`("group": "${group}",(\\s*)"pages": )\\[[^\\]]*\\]`);
  if (languageStart < 0 || !pattern.test(after)) throw new Error(`docs.json has no ${group} pages list to rewrite`);
  const rewritten = after.replace(pattern, (_whole, head: string, spacing: string) => {
    const indent = spacing.slice(spacing.lastIndexOf('\n') + 1);
    const lines = input.pages.map((page) => `${indent}  ${JSON.stringify(page)}`);
    return `${head}[\n${lines.join(',\n')}\n${indent}]`;
  });
  return `${before}${rewritten}`;
}

function foreignPagesViolationsOf(input: { source: string; language: DocsPageLanguage }): string[] {
  return pagesOf(input)
    .filter((page) => typeof page !== 'string' || !OWNED_PAGE_PATTERN.test(page))
    .map((page) => `the ${NAVIGATION_GROUPS[input.language]} group holds ${String(page)}, which the generator does not own`);
}

export function renderNavigation(input: { source: string; agents: ResolvedAgent[] }): RenderedNavigation {
  const languages = Object.values(DocsPageLanguage);
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

export function listedAgentSlugsOf(input: { source: string }): string[] {
  const languages = Object.values(DocsPageLanguage);
  const listedPages = languages.flatMap((language) => pagesOf({ source: input.source, language }));
  return [
    ...new Set(
      listedPages.flatMap((page) => (typeof page === 'string' && OWNED_PAGE_PATTERN.test(page) ? [page.split('/').at(-1) as string] : [])),
    ),
  ];
}

export function orphanPagesOf(input: { existingPaths: string[]; agentIds: string[]; listedSlugs: string[] }): {
  deletions: string[];
  violations: string[];
} {
  const slugs = [
    ...new Set(
      input.existingPaths
        .map((path) => ORPHAN_PATH_PATTERN.exec(path)?.[1])
        .filter((slug): slug is string => slug !== undefined && slug !== MATRIX_PAGE_NAME && !input.agentIds.includes(slug)),
    ),
  ];
  const removedSlugs = slugs.filter((slug) => input.listedSlugs.includes(slug));
  const unknownSlugs = slugs.filter((slug) => !input.listedSlugs.includes(slug));
  return {
    deletions: removedSlugs.flatMap((slug) => Object.values(PAGE_DIRECTORIES).map((directory) => `${directory}/${slug}${PAGE_EXTENSION}`)),
    violations: unknownSlugs.map(
      (slug) =>
        `${AGENTS_DIRECTORY}/${slug} has no agent folder and is not in the Agents lists: the generator does not delete a hand-written page`,
    ),
  };
}
