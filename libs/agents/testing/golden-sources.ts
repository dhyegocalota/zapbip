import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INSTALL_PAGE_COPY, renderInstallPage } from '@zapbip/core';
import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import { INSTALL_PAGE_SECTIONS } from '../src/generated/install';

export type MatrixRows = Record<string, string>;
export type NavigationEntries = Record<string, string>;
export type GoldenOrder = {
  installPage: string[];
  matrix: Record<DocsLanguage, string[]>;
  navigation: Record<DocsLanguage, string[]>;
};

export const GOLDEN_FOLDER = fileURLToPath(new URL('./golden/', import.meta.url));
export const GOLDEN_AGENT = 'Ana';
export const GOLDEN_STANDBY_AGENT = 'Lia';
export const GOLDEN_CONNECTION_LINK = 'https://golden.example/c/zb_conn_GOLDEN/mcp';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LINE_SEPARATOR = '\n';
const SECTION_SEPARATOR = '\n\n';
const SECTION_START = /\n\n(?=## )/;
const SECTION_MARKER = '## ';
const FIXED_HEADINGS = ['## Identify your product', '## Rules you follow after install'];
const PRODUCT_LIST_PATTERN = /(Find which product you run in: )(.*?)(\. If none matches)/;
const PRODUCT_LIST_SEPARATOR = ', ';
const CELL_SEPARATOR = '|';
const JOINED_CELL_SEPARATOR = ' | ';
const MATRIX_LINK_PATTERN = /\]\(\/(?:pt-br\/)?agents\/([a-z-]+)\)/;
const SUPPORTED_AGENTS_PAGE = 'supported-agents';
const DOCS_CONFIG = 'apps/docs/docs.json';
const NAVIGATION_PAGE_PATTERN = /^(?:pt-br\/)?agents\/(.+)$/;

const MATRIX_SNIPPET: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'apps/docs/snippets/agents/matrix.mdx',
  [DocsLanguage.PortugueseBrazil]: 'apps/docs/snippets/pt-br/agents/matrix.mdx',
};

const NAVIGATION_GROUP: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'Agents',
  [DocsLanguage.PortugueseBrazil]: 'IAs',
};

type NavigationLanguage = { language: string; groups: { group: string; pages: unknown[] }[] };

export function repositoryFile(path: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${path}`, 'utf8');
}

export function installPageOf(input: { locale: OwnerLocale; standbyAgent: string | null }): string {
  return renderInstallPage({
    agent: GOLDEN_AGENT,
    connectionLink: GOLDEN_CONNECTION_LINK,
    locale: input.locale,
    standbyAgent: input.standbyAgent,
    sections: INSTALL_PAGE_SECTIONS,
  });
}

export function productHeadingsOf(input: { page: string }): string[] {
  return input.page
    .split(LINE_SEPARATOR)
    .filter((line) => line.startsWith(SECTION_MARKER) && !FIXED_HEADINGS.includes(line))
    .map((line) => line.slice(SECTION_MARKER.length));
}

export function canonicalInstallPageOf(input: { page: string; locale: OwnerLocale }): string {
  const { footer } = INSTALL_PAGE_COPY[input.locale];
  if (!input.page.endsWith(footer)) throw new Error('the install page does not end with its footer');
  const body = input.page.slice(0, -(footer.length + SECTION_SEPARATOR.length));
  const blocks = body.split(SECTION_START);
  const fixedBlocks = blocks.filter(
    (block) => block.startsWith(SECTION_MARKER) === false || FIXED_HEADINGS.some((heading) => block.startsWith(heading)),
  );
  const productBlocks = blocks.filter((block) => !fixedBlocks.includes(block)).sort((left, right) => left.localeCompare(right));
  return [...fixedBlocks, ...productBlocks, footer].join(SECTION_SEPARATOR).replace(
    PRODUCT_LIST_PATTERN,
    (_whole, before: string, names: string, after: string) =>
      `${before}${names
        .split(PRODUCT_LIST_SEPARATOR)
        .sort((left, right) => left.localeCompare(right))
        .join(PRODUCT_LIST_SEPARATOR)}${after}`,
  );
}

function matrixRowsOf(input: { language: DocsLanguage }): string[] {
  return repositoryFile(MATRIX_SNIPPET[input.language])
    .split(LINE_SEPARATOR)
    .filter((line) => MATRIX_LINK_PATTERN.test(line));
}

function matrixIdOf(input: { row: string }): string {
  const match = MATRIX_LINK_PATTERN.exec(input.row);
  if (!match) throw new Error(`no agent link in the matrix row ${input.row}`);
  return match[1] as string;
}

export function matrixOrderOf(input: { language: DocsLanguage }): string[] {
  return matrixRowsOf(input).map((row) => matrixIdOf({ row }));
}

export function matrixRowsByAgentOf(input: { language: DocsLanguage }): MatrixRows {
  return Object.fromEntries(
    matrixRowsOf(input).map((row) => [
      matrixIdOf({ row }),
      row
        .split(CELL_SEPARATOR)
        .slice(1, -1)
        .map((cell) => cell.trim())
        .join(JOINED_CELL_SEPARATOR),
    ]),
  );
}

function navigationPagesOf(input: { language: DocsLanguage }): string[] {
  const languages = JSON.parse(repositoryFile(DOCS_CONFIG)).navigation.languages as NavigationLanguage[];
  const entry = languages.find((candidate) => candidate.language === input.language);
  if (!entry) throw new Error(`no navigation for ${input.language}`);
  const group = entry.groups.find((candidate) => candidate.group === NAVIGATION_GROUP[input.language]);
  if (!group) throw new Error(`no ${NAVIGATION_GROUP[input.language]} group`);
  return group.pages as string[];
}

function navigationIdOf(input: { page: string }): string {
  const match = NAVIGATION_PAGE_PATTERN.exec(input.page);
  if (!match) throw new Error(`not an agents page: ${input.page}`);
  return match[1] as string;
}

export function navigationOrderOf(input: { language: DocsLanguage }): string[] {
  return navigationPagesOf(input)
    .map((page) => navigationIdOf({ page }))
    .filter((id) => id !== SUPPORTED_AGENTS_PAGE);
}

export function navigationEntriesOf(input: { language: DocsLanguage }): NavigationEntries {
  return Object.fromEntries(navigationPagesOf(input).map((page) => [navigationIdOf({ page }), page]));
}

export function orderOf(): GoldenOrder {
  const languages = Object.values(DocsLanguage);
  return {
    installPage: productHeadingsOf({ page: installPageOf({ locale: OwnerLocale.EnglishUs, standbyAgent: null }) }),
    matrix: Object.fromEntries(languages.map((language) => [language, matrixOrderOf({ language })])) as GoldenOrder['matrix'],
    navigation: Object.fromEntries(languages.map((language) => [language, navigationOrderOf({ language })])) as GoldenOrder['navigation'],
  };
}
