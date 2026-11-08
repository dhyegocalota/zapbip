import {
  AGENTS_DIRECTORY,
  AGENT_PAGE_HEADINGS,
  AGENT_PAGE_SECTIONS,
  AgentPageSection,
  DOCS_GROUPS,
  LISTEN_STATEMENT_TOKENS,
  WAKE_RUNG_LABELS,
  agentPagePathOf,
  twinPathOf,
} from '@zapbip/agents/docs';
import { ConnectorClient } from '@zapbip/agents/connector';
import { MEDIA_RETENTION_MS, QUEUE_RETENTION_MS, QUESTION_RETENTION_MS } from '@zapbip/core';
import { DAY_MS, DocsLanguage, DocsRetentionKind, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { DOCS_ROOT, capturedNames, readRepositoryFile } from './repository-files';

export const DOCS_DEVELOPER_LINK_PREFIXES: string[] = [
  '/developers/',
  '/mcp-reference/',
  '/concepts/',
  `/${PAGE_LANGUAGE_FOLDER}/developers/`,
  `/${PAGE_LANGUAGE_FOLDER}/mcp-reference/`,
  `/${PAGE_LANGUAGE_FOLDER}/concepts/`,
];

export const CHAT_MAX_MESSAGES = 4;

export const INSTALL_PROMPT_MAX_LINES = 2;

export const RETENTION_DAYS: Record<DocsRetentionKind, number> = {
  [DocsRetentionKind.Questions]: QUESTION_RETENTION_MS / DAY_MS,
  [DocsRetentionKind.Queue]: QUEUE_RETENTION_MS / DAY_MS,
  [DocsRetentionKind.Media]: MEDIA_RETENTION_MS / DAY_MS,
};

const LINE_SEPARATOR = '\n';
const SECTION_MARKER = '## ';
const SECTION_SPLIT_PATTERN = /^## /m;
const SECTION_HEADING_PATTERN = /^##\s+(.+?)\s*$/gm;
const CHAT_BLOCK_PATTERN = /<Chat\b[\s\S]*?\/>/g;
const MESSAGES_OPENER = 'messages={[';
const STRING_LITERAL_PATTERN = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
const NESTING_OPENERS = ['{', '[', '('];
const NESTING_CLOSERS = ['}', ']', ')'];
const MESSAGE_OPENER = '{';
const MARKDOWN_LINK_PATTERN = /\]\(([^)\s]+)/g;
const ATTRIBUTE_LINK_PATTERN = /href="([^"]+)"/g;
const ANCHOR_PATTERN = /#.*$/;
const INDEX_PAGE = 'index';
const GUARDED_PAGE_PREFIXES = ['features/', 'help/', 'get-started/', `${AGENTS_DIRECTORY}/`];
const GENERIC_MCP_CLIENT_PAGE_LINK = '/developers/any-mcp-client';
const BACKGROUND_RUNNING_LINK = '/developers/background-running';
const BACKGROUND_RUNNING_PAGES = Object.values(ConnectorClient).map((client) => `${AGENTS_DIRECTORY}/${client}`);

type NestingScan = { depth: number; messages: number };

export function headingsOf(input: { markdown: string }): string[] {
  return capturedNames({ text: input.markdown, pattern: SECTION_HEADING_PATTERN });
}

export function sectionOf(input: { markdown: string; heading: string }): string {
  const sections = input.markdown.split(SECTION_SPLIT_PATTERN).slice(1);
  const section = sections.find((candidate) => candidate.slice(0, candidate.indexOf(LINE_SEPARATOR)).trim() === input.heading);
  if (section === undefined) throw new Error(`no section ${SECTION_MARKER}${input.heading}`);
  return section.slice(section.indexOf(LINE_SEPARATOR) + 1);
}

export function chatBlocksOf(input: { markdown: string }): string[] {
  return [...input.markdown.matchAll(CHAT_BLOCK_PATTERN)].map((match) => match[0]);
}

export function messageCountOf(input: { block: string }): number {
  const opener = input.block.indexOf(MESSAGES_OPENER);
  if (opener < 0) throw new Error('the chat has no messages array');
  const body = input.block.slice(opener + MESSAGES_OPENER.length).replace(STRING_LITERAL_PATTERN, '');
  return [...body].reduce<NestingScan>(
    (scan, character) => {
      if (NESTING_OPENERS.includes(character)) {
        const isMessage = character === MESSAGE_OPENER && scan.depth === 0;
        return { depth: scan.depth + 1, messages: scan.messages + Number(isMessage) };
      }
      if (NESTING_CLOSERS.includes(character)) return { ...scan, depth: scan.depth - 1 };
      return scan;
    },
    { depth: 0, messages: 0 },
  ).messages;
}

export function linksOf(input: { markdown: string }): string[] {
  return [
    ...capturedNames({ text: input.markdown, pattern: MARKDOWN_LINK_PATTERN }),
    ...capturedNames({ text: input.markdown, pattern: ATTRIBUTE_LINK_PATTERN }),
  ];
}

export function linesOf(input: { text: string }): string[] {
  return input.text
    .split(LINE_SEPARATOR)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function missingListenTokens(input: { section: string; language: DocsLanguage }): string[] {
  const section = input.section.toLowerCase();
  return Object.values(LISTEN_STATEMENT_TOKENS[input.language]).filter((token) => !section.includes(token.toLowerCase()));
}

export function developerLinkViolations(input: { page: string; links: string[] }): string[] {
  const englishPage = twinPathOf({ path: input.page, language: DocsLanguage.English });
  const isGuarded = englishPage === INDEX_PAGE || GUARDED_PAGE_PREFIXES.some((prefix) => englishPage.startsWith(prefix));
  if (!isGuarded) return [];
  const isAgentPage = englishPage.startsWith(`${AGENTS_DIRECTORY}/`);
  const allowedLinks = [
    ...(isAgentPage ? [GENERIC_MCP_CLIENT_PAGE_LINK] : []),
    ...(BACKGROUND_RUNNING_PAGES.includes(englishPage) ? [BACKGROUND_RUNNING_LINK] : []),
  ];
  const englishLinkOf = (link: string): string =>
    `/${twinPathOf({ path: link.slice(1).replace(ANCHOR_PATTERN, ''), language: DocsLanguage.English })}`;
  return input.links
    .filter((link) => DOCS_DEVELOPER_LINK_PREFIXES.some((prefix) => link.startsWith(prefix)))
    .filter((link) => !allowedLinks.includes(englishLinkOf(link)))
    .map((link) => `${input.page} -> ${link}`);
}

export type NavigationNode = string | { group: string; pages: NavigationNode[] };
export type LanguageNavigation = { language: string; groups: { group: string; pages: NavigationNode[] }[] };

const DOCS_CONFIG = `${DOCS_ROOT}/docs.json`;

export function docsNavigationOf(input: { language: DocsLanguage }): LanguageNavigation {
  const languages = JSON.parse(readRepositoryFile(DOCS_CONFIG)).navigation.languages as LanguageNavigation[];
  const found = languages.find((entry) => entry.language === input.language);
  if (!found) throw new Error(`no navigation for ${input.language}`);
  return found;
}

function pagesOf(nodes: NavigationNode[]): string[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? [node] : pagesOf(node.pages)));
}

export function navigationPagesOf(input: { language: DocsLanguage }): string[] {
  return pagesOf(docsNavigationOf(input).groups.flatMap((group) => group.pages));
}

export {
  AGENT_PAGE_HEADINGS,
  AGENT_PAGE_SECTIONS,
  AgentPageSection,
  DOCS_GROUPS,
  LISTEN_STATEMENT_TOKENS,
  WAKE_RUNG_LABELS,
  agentPagePathOf,
  twinPathOf,
};
