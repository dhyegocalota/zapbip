import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { AgentId } from '@zapbip/agents/definitions';
import { ConnectorClient } from '@zapbip/agents/connector';
import {
  DocsLanguage,
  DocsRetentionKind,
  McpToolName,
  MessageKind,
  PAGE_LANGUAGE_FOLDER,
  START_LINK,
  START_LINK_LANGUAGE_PARAMETER,
} from '@zapbip/types';
import {
  AGENT_PAGE_HEADINGS,
  AGENT_PAGE_SECTIONS,
  AgentPageSection,
  CHAT_MAX_MESSAGES,
  DOCS_GROUPS,
  INSTALL_PROMPT_MAX_LINES,
  RETENTION_DAYS,
  agentPagePathOf,
  chatBlocksOf,
  developerLinkViolations,
  docsNavigationOf,
  headingsOf,
  linesOf,
  linksOf,
  messageCountOf,
  missingListenTokens,
  navigationPagesOf,
  sectionOf,
  twinPathOf,
} from './docs-experience';
import { DOCS_ROOT, PAGE_EXTENSION, capturedNames, documentFiles, readRepositoryFile, repositoryPath } from './repository-files';

const SNIPPETS_DIRECTORY = 'snippets';
const AGENTS_DIRECTORY = 'agents';
const MATRIX_PAGE = 'agents/supported-agents';
const MATRIX_SNIPPET = 'agents/matrix';
const INSTALL_PROMPT_SNIPPET = 'install-prompt';
const START_LINK_SNIPPET = 'start-link';
const AGENT_PAGE_SOURCES_DIRECTORY = 'libs/agents/supported';
const NAVIGATION_TEST_FILE = 'tools/repository-shape/src/docs-navigation.test.ts';
const SOURCE_EXTENSIONS = ['.mdx', '.md', '.json', '.jsx'];
const IGNORED_DIRECTORY = 'node_modules';
const LINE_SEPARATOR = '\n';
const COMING_SOON_PATTERN = /coming soon|em breve|\bbeta\b/gi;
const TEST_DOUBLE_PATTERN = /\b(fake|simulator|simulador)\b/gi;
const INSTALL_CODE_PATTERN = /zb_inst_[A-Za-z0-9]{8,}/g;
const INSTALL_LINK_ORIGIN = 'https://mcp.zapbip.com';
const INSTALL_LINK_PATTERN = /https:\/\/[^\s/]+\/i\/zb_inst_[^\s`'"]+/g;
const LINK_PATH_PATTERN = /\/[ci]\/([^\s)`'"]+)/g;
const PLACEHOLDER_MARK = '<';
const PHONE_NUMBER_LINK_PATTERN = /wa\.me|OFFICIAL_(WHATSAPP_)?NUMBER|official-number|\+\d{7,}/g;
const MATRIX_LINK_PATTERN = /\]\(\/(?:pt-br\/)?agents\/([a-z0-9-]+)\)/g;
const TABLE_ROW_PATTERN = /^\|/;
const TABLE_HEADER_ROW_COUNT = 2;
const NEW_CLIENT_PAGE = 'agents/x';
const WRONG_MEDIA_DAYS = 14;
const PRIVACY_PAGE = 'help/privacy-and-security';
const MCP_REFERENCE_FOLDER = 'mcp-reference';
const MESSAGE_KINDS_SNIPPET = 'message-kinds';
const TOOL_NAME_SEPARATOR = '_';
const PAGE_NAME_SEPARATOR = '-';
const EXTRA_TOOL_PAGE = 'mcp-reference/not-a-tool';
const FIRST_CELL_PATTERN = /^\|\s*`([a-z]+)`/g;

const LANGUAGES = Object.values(DocsLanguage);
const CLIENTS: AgentId[] = Object.values(AgentId);
const CONNECTOR_CLIENTS: string[] = Object.values(ConnectorClient);
const BACKGROUND_RUNNING_PATH = 'developers/background-running';
const pageFileOf = (page: string): string => `${DOCS_ROOT}/${page}${PAGE_EXTENSION}`;
const withoutExtension = (path: string): string => path.slice(0, -PAGE_EXTENSION.length);
const pageEntries = documentFiles('')
  .filter((path) => !path.startsWith(`${SNIPPETS_DIRECTORY}/`))
  .map(withoutExtension);
const languageOf = (page: string): DocsLanguage =>
  page.startsWith(`${PAGE_LANGUAGE_FOLDER}/`) ? DocsLanguage.PortugueseBrazil : DocsLanguage.English;
const snippetPathOf = ({ name, language }: { name: string; language: DocsLanguage }): string =>
  language === DocsLanguage.English
    ? `${DOCS_ROOT}/${SNIPPETS_DIRECTORY}/${name}${PAGE_EXTENSION}`
    : `${DOCS_ROOT}/${SNIPPETS_DIRECTORY}/${PAGE_LANGUAGE_FOLDER}/${name}${PAGE_EXTENSION}`;

function docsSourceFiles(): Record<string, string> {
  const paths = readdirSync(repositoryPath(DOCS_ROOT), { recursive: true, encoding: 'utf8' })
    .filter((path) => !path.split('/').includes(IGNORED_DIRECTORY))
    .filter((path) => SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension)));
  return Object.fromEntries(paths.map((path) => [path, readRepositoryFile(`${DOCS_ROOT}/${path}`)]));
}

function duplicatedPaths({ paths }: { paths: string[] }): string[] {
  return paths.filter((path, index) => paths.indexOf(path) !== index);
}

function missingTwins({ paths }: { paths: string[] }): string[] {
  return paths
    .map((path) =>
      twinPathOf({ path, language: languageOf(path) === DocsLanguage.English ? DocsLanguage.PortugueseBrazil : DocsLanguage.English }),
    )
    .filter((twin) => !paths.includes(twin));
}

function missingAgentPages({ clients, pageExists }: { clients: AgentId[]; pageExists: (page: string) => boolean }): string[] {
  return clients.flatMap((client) =>
    LANGUAGES.map((language) => agentPagePathOf({ client, language })).filter((page) => !pageExists(page)),
  );
}

function matrixClientsOf({ markdown }: { markdown: string }): string[] {
  return markdown
    .split(LINE_SEPARATOR)
    .filter((line) => TABLE_ROW_PATTERN.test(line))
    .flatMap((line) => capturedNames({ text: line, pattern: MATRIX_LINK_PATTERN }));
}

function unmatrixedAgentPages({ matrixClients, pages }: { matrixClients: string[]; pages: string[] }): string[] {
  return pages.filter((page) => !matrixClients.includes(page));
}

function agentHeadingViolations({ page, markdown, language }: { page: string; markdown: string; language: DocsLanguage }): string[] {
  const expected = AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[language][section]);
  const actual = headingsOf({ markdown }).filter((heading) => expected.includes(heading));
  const isInOrder = actual.join(LINE_SEPARATOR) === expected.join(LINE_SEPARATOR);
  return isInOrder ? [] : [`${page}: expected ${expected.join(' | ')} but found ${actual.join(' | ')}`];
}

function listenTokenViolations({ page, markdown, language }: { page: string; markdown: string; language: DocsLanguage }): string[] {
  const section = sectionOf({ markdown, heading: AGENT_PAGE_HEADINGS[language][AgentPageSection.HowItListens] });
  return missingListenTokens({ section, language }).map((token) => `${page}: missing ${token}`);
}

function mcpReferencePagesOf({ language }: { language: DocsLanguage }): string[] {
  const prefix = language === DocsLanguage.English ? `${MCP_REFERENCE_FOLDER}/` : `${PAGE_LANGUAGE_FOLDER}/${MCP_REFERENCE_FOLDER}/`;
  return pageEntries.filter((page) => page.startsWith(prefix));
}

function toolPageOf({ tool, language }: { tool: McpToolName; language: DocsLanguage }): string {
  const page = `${MCP_REFERENCE_FOLDER}/${tool.replaceAll(TOOL_NAME_SEPARATOR, PAGE_NAME_SEPARATOR)}`;
  return language === DocsLanguage.English ? page : `${PAGE_LANGUAGE_FOLDER}/${page}`;
}

function toolPageViolations({ tools, pages, language }: { tools: McpToolName[]; pages: string[]; language: DocsLanguage }): string[] {
  const expected = tools.map((tool) => toolPageOf({ tool, language }));
  const missing = expected.filter((page) => !pages.includes(page)).map((page) => `missing ${page}`);
  const extra = pages.filter((page) => !expected.includes(page)).map((page) => `extra ${page}`);
  return [...missing, ...extra];
}

function messageKindViolations({ snippet, kinds }: { snippet: string; kinds: MessageKind[] }): string[] {
  const listed = snippet.split(LINE_SEPARATOR).flatMap((line) => capturedNames({ text: line, pattern: FIRST_CELL_PATTERN }));
  return kinds.filter((kind) => !listed.includes(kind)).map((kind) => `missing ${kind}`);
}

function chatLengthViolations({ page, markdown }: { page: string; markdown: string }): string[] {
  return chatBlocksOf({ markdown })
    .filter((block) => messageCountOf({ block }) > CHAT_MAX_MESSAGES)
    .map((block) => `${page}:${markdown.slice(0, markdown.indexOf(block)).split(LINE_SEPARATOR).length}`);
}

function forbiddenViolations({ files, pattern }: { files: Record<string, string>; pattern: RegExp }): string[] {
  return Object.entries(files).flatMap(([path, text]) => [...text.matchAll(pattern)].map((match) => `${path}: ${match[0]}`));
}

function secretViolations({ files }: { files: Record<string, string> }): string[] {
  const realCodes = forbiddenViolations({ files, pattern: INSTALL_CODE_PATTERN });
  const bareLinkPaths = Object.entries(files).flatMap(([path, text]) =>
    [...text.matchAll(LINK_PATH_PATTERN)].filter((match) => !match[1]?.includes(PLACEHOLDER_MARK)).map((match) => `${path}: ${match[0]}`),
  );
  return [...realCodes, ...bareLinkPaths];
}

function identicalViolations({ english, translated }: { english: string; translated: string }): string[] {
  return english === translated ? ['the translated snippet equals the English one'] : [];
}

function startLinkViolations({ snippet, language }: { snippet: string; language: DocsLanguage }): string[] {
  const expectedLink = `${START_LINK}?${START_LINK_LANGUAGE_PARAMETER}=${language}`;
  return snippet.includes(expectedLink) ? [] : [`missing ${expectedLink}`];
}

function agentPageSourceFiles(): Record<string, string> {
  const paths = readdirSync(repositoryPath(AGENT_PAGE_SOURCES_DIRECTORY), { recursive: true, encoding: 'utf8' })
    .filter((path) => !path.split('/').includes(IGNORED_DIRECTORY))
    .filter((path) => path.endsWith(PAGE_EXTENSION));
  return Object.fromEntries(
    paths.map((path) => [`${AGENT_PAGE_SOURCES_DIRECTORY}/${path}`, readRepositoryFile(`${AGENT_PAGE_SOURCES_DIRECTORY}/${path}`)]),
  );
}

function retentionFigureViolations({ markdown, kind }: { markdown: string; kind: DocsRetentionKind }): string[] {
  const figure = new RegExp(`\\b${RETENTION_DAYS[kind]}\\s+(days|dias)\\b`);
  return figure.test(markdown) ? [] : [`${kind}: expected ${RETENTION_DAYS[kind]} days`];
}

const fiveMessageChat = [
  'Intro',
  '',
  '<Chat',
  '  messages={[',
  "    { you: true, text: 'one' },",
  "    { name: 'Claude', text: 'two' },",
  "    { you: true, text: 'three' },",
  "    { name: 'Claude', text: 'four' },",
  "    { you: true, text: 'five' },",
  '  ]}',
  '/>',
].join(LINE_SEPARATOR);

describe('docs experience: navigation', () => {
  test('pt-BR group names are in the same order', () => {
    const groups = docsNavigationOf({ language: DocsLanguage.PortugueseBrazil }).groups.map((entry) => entry.group);
    expect(groups).toEqual(DOCS_GROUPS[DocsLanguage.PortugueseBrazil]);
  });

  test('every .mdx under apps/docs is listed in docs.json exactly once', () => {
    const listed = LANGUAGES.flatMap((language) => navigationPagesOf({ language }));
    const unlisted = pageEntries.filter((page) => !listed.includes(page));
    expect({ duplicated: duplicatedPaths({ paths: listed }), unlisted }).toEqual({ duplicated: [], unlisted: [] });
  });

  test('a page listed twice fails naming the path', () => {
    expect(duplicatedPaths({ paths: ['features/a', 'features/b', 'features/a'] })).toEqual(['features/a']);
  });

  test('a pt-br file with no English file fails naming the English path', () => {
    expect(missingTwins({ paths: ['pt-br/features/x'] })).toEqual(['features/x']);
  });

  test('docs-navigation.test.ts uses DocsLanguage values and no language string literal', () => {
    expect(readRepositoryFile(NAVIGATION_TEST_FILE)).not.toMatch(/['"](en|pt-BR)['"]/);
  });
});

describe('docs experience: agent pages', () => {
  test('every client has an agent page in both languages', () => {
    const missing = missingAgentPages({ clients: CLIENTS, pageExists: (page) => existsSync(repositoryPath(pageFileOf(page))) });
    expect(missing).toEqual([]);
  });

  test('a client with no page fails naming it', () => {
    const [client] = CLIENTS as [AgentId];
    expect(missingAgentPages({ clients: [client], pageExists: () => false })).toEqual(
      LANGUAGES.map((language) => agentPagePathOf({ client, language })),
    );
  });

  test.each(LANGUAGES)('the matrix has exactly one row per client in %s', (language) => {
    const markdown = readRepositoryFile(snippetPathOf({ name: MATRIX_SNIPPET, language }));
    const rows = markdown.split(LINE_SEPARATOR).filter((line) => TABLE_ROW_PATTERN.test(line)).length - TABLE_HEADER_ROW_COUNT;
    expect(rows).toBe(CLIENTS.length);
    expect(matrixClientsOf({ markdown }).sort()).toEqual([...CLIENTS].sort());
  });

  test.each(LANGUAGES)('every agent appears in the navigation and as a page in %s', (language) => {
    const listed = navigationPagesOf({ language });
    const expected = CLIENTS.map((client) => agentPagePathOf({ client, language }));
    expect(listed.filter((page) => expected.includes(page)).sort()).toEqual([...expected].sort());
    expect(expected.filter((page) => !existsSync(repositoryPath(pageFileOf(page))))).toEqual([]);
  });

  test('an agent page with no matrix row fails naming it', () => {
    expect(unmatrixedAgentPages({ matrixClients: ['agent-two'], pages: ['agent-two', NEW_CLIENT_PAGE] })).toEqual([NEW_CLIENT_PAGE]);
  });

  test('every agent page has no page without a matrix row', () => {
    const pages = documentFiles(AGENTS_DIRECTORY).map((path) => withoutExtension(path).replace(`${AGENTS_DIRECTORY}/`, ''));
    const matrixClients = matrixClientsOf({
      markdown: readRepositoryFile(snippetPathOf({ name: MATRIX_SNIPPET, language: DocsLanguage.English })),
    });
    const clientPages = pages.filter((page) => `${AGENTS_DIRECTORY}/${page}` !== MATRIX_PAGE);
    expect(unmatrixedAgentPages({ matrixClients, pages: clientPages })).toEqual([]);
  });

  test.each(LANGUAGES)('every agent page has the four headings in order in %s', (language) => {
    const violations = CLIENTS.flatMap((client) => {
      const page = agentPagePathOf({ client, language });
      return agentHeadingViolations({ page, markdown: readRepositoryFile(pageFileOf(page)), language });
    });
    expect(violations).toEqual([]);
  });

  test('headings out of order fail with the page and the order', () => {
    const headings = AGENT_PAGE_HEADINGS[DocsLanguage.English];
    const markdown = [
      AgentPageSection.WhatWorks,
      AgentPageSection.SetupFromZero,
      AgentPageSection.HowItListens,
      AgentPageSection.CheckItWorks,
    ]
      .map((section) => `## ${headings[section]}\n\ntext`)
      .join('\n\n');
    const violations = agentHeadingViolations({ page: 'agents/x', markdown, language: DocsLanguage.English });
    expect(violations).toEqual([
      'agents/x: expected What works | How it listens | Set up from zero | Check it works but found What works | Set up from zero | How it listens | Check it works',
    ]);
  });

  test('a pt-br agent page with English headings fails', () => {
    const markdown = '## What works\n\ntext';
    expect(agentHeadingViolations({ page: 'pt-br/agents/x', markdown, language: DocsLanguage.PortugueseBrazil })).toHaveLength(1);
  });

  test('a How-it-listens section with only the rung fails naming the page and the tokens', () => {
    const headings = AGENT_PAGE_HEADINGS[DocsLanguage.English];
    const markdown = `## ${headings[AgentPageSection.HowItListens]}\n\nIt is Local.\n\n## ${headings[AgentPageSection.SetupFromZero]}\n\nSteps.`;
    expect(listenTokenViolations({ page: 'agents/x', markdown, language: DocsLanguage.English })).toEqual([
      'agents/x: missing pending',
      'agents/x: missing again',
      'agents/x: missing no time limit',
    ]);
  });
});

describe('docs experience: developer boundary', () => {
  test('no guarded page links to a developer page beyond the allowed footer links', () => {
    const violations = pageEntries.flatMap((page) =>
      developerLinkViolations({ page, links: linksOf({ markdown: readRepositoryFile(pageFileOf(page)) }) }),
    );
    expect(violations).toEqual([]);
  });

  test('a feature page linking the MCP reference fails naming the page and the href', () => {
    expect(developerLinkViolations({ page: 'features/send-messages-and-media', links: ['/mcp-reference/send-message'] })).toEqual([
      'features/send-messages-and-media -> /mcp-reference/send-message',
    ]);
  });

  test('an agent page may carry one developer footer link only', () => {
    expect(
      developerLinkViolations({ page: 'agents/agent-seven', links: ['/developers/any-mcp-client', '/developers/local-connector'] }),
    ).toEqual(['agents/agent-seven -> /developers/local-connector']);
  });

  test.each(LANGUAGES)('background running is allowed exactly on the pages of agents with a connector, in %s', (language) => {
    const violationsOf = (client: AgentId): string[] => {
      const page = agentPagePathOf({ client, language });
      return developerLinkViolations({ page, links: [`/${twinPathOf({ path: BACKGROUND_RUNNING_PATH, language })}`] });
    };
    const allowedClients = CLIENTS.filter((client) => violationsOf(client).length === 0);
    expect(allowedClients.sort()).toEqual([...CONNECTOR_CLIENTS].sort());
  });

  test('a pt-br feature page linking the MCP reference fails', () => {
    expect(developerLinkViolations({ page: 'pt-br/features/x', links: ['/pt-br/mcp-reference/send-message'] })).toEqual([
      'pt-br/features/x -> /pt-br/mcp-reference/send-message',
    ]);
  });
});

describe('docs experience: copy', () => {
  test('every example chat has at most the maximum number of messages', () => {
    const violations = pageEntries.flatMap((page) => chatLengthViolations({ page, markdown: readRepositoryFile(pageFileOf(page)) }));
    expect(violations).toEqual([]);
  });

  test('a five-message chat fails naming the page and the line', () => {
    expect(chatLengthViolations({ page: 'fixture.mdx', markdown: fiveMessageChat })).toEqual(['fixture.mdx:3']);
  });

  test('no page promises the future', () => {
    expect(forbiddenViolations({ files: docsSourceFiles(), pattern: COMING_SOON_PATTERN })).toEqual([]);
  });

  test('the docs never name the test double', () => {
    expect(forbiddenViolations({ files: docsSourceFiles(), pattern: TEST_DOUBLE_PATTERN })).toEqual([]);
  });

  test('a test double word in a snippet fails naming the file', () => {
    const files = { 'snippets/pt-br/install-prompt.mdx': 'Use o simulador.' };
    expect(forbiddenViolations({ files, pattern: TEST_DOUBLE_PATTERN })).toEqual(['snippets/pt-br/install-prompt.mdx: simulador']);
  });

  test('no real code or secret appears and every install or connection path shows a placeholder', () => {
    expect(secretViolations({ files: docsSourceFiles() })).toEqual([]);
  });

  test('a real-looking install code fails', () => {
    const realLookingCode = ['zb', 'inst', 'AbC123xyz987'].join('_');
    expect(secretViolations({ files: { 'snippets/install-prompt.mdx': `read https://zapbip.com/i/${realLookingCode}` } })).toHaveLength(2);
  });

  test('every install link in the docs is served from the connector origin', () => {
    const wrongOriginLinks = Object.entries(docsSourceFiles()).flatMap(([path, content]) =>
      Array.from(content.matchAll(INSTALL_LINK_PATTERN), (match) => match[0])
        .filter((link) => !link.startsWith(`${INSTALL_LINK_ORIGIN}/`))
        .map((link) => `${path}: ${link}`),
    );
    expect(wrongOriginLinks).toEqual([]);
  });

  test.each(LANGUAGES)('the install prompt snippet is at most the maximum number of lines in %s', (language) => {
    const text = readRepositoryFile(snippetPathOf({ name: INSTALL_PROMPT_SNIPPET, language }));
    expect(linesOf({ text }).length).toBeGreaterThan(0);
    expect(linesOf({ text }).length).toBeLessThanOrEqual(INSTALL_PROMPT_MAX_LINES);
  });

  test('the pt-BR install prompt differs from the English one', () => {
    const english = readRepositoryFile(snippetPathOf({ name: INSTALL_PROMPT_SNIPPET, language: DocsLanguage.English }));
    const translated = readRepositoryFile(snippetPathOf({ name: INSTALL_PROMPT_SNIPPET, language: DocsLanguage.PortugueseBrazil }));
    expect(identicalViolations({ english, translated })).toEqual([]);
  });

  test('an identical pt-BR install prompt fails', () => {
    expect(identicalViolations({ english: 'same', translated: 'same' })).toHaveLength(1);
  });

  test.each(LANGUAGES)('the start link snippet in %s links the start link in that language', (language) => {
    const snippet = readRepositoryFile(snippetPathOf({ name: START_LINK_SNIPPET, language }));
    expect(startLinkViolations({ snippet, language })).toEqual([]);
  });

  test('a snippet that links the other language fails', () => {
    const snippet = `${START_LINK}?${START_LINK_LANGUAGE_PARAMETER}=${DocsLanguage.English}`;
    expect(startLinkViolations({ snippet, language: DocsLanguage.PortugueseBrazil })).toEqual([
      `missing ${START_LINK}?${START_LINK_LANGUAGE_PARAMETER}=${DocsLanguage.PortugueseBrazil}`,
    ]);
  });

  test('no docs file or agent page source prints a phone number link or an official number token', () => {
    const files = { ...docsSourceFiles(), ...agentPageSourceFiles() };
    expect(forbiddenViolations({ files, pattern: PHONE_NUMBER_LINK_PATTERN })).toEqual([]);
  });

  test.each(['+55 11 99999-0001', '5511999990001', '(11) 99999-0001', '+5511999990001'])(
    'a planted formatted number %s is reported',
    (number) => {
      const files = { 'get-started/how-to-start.mdx': `Message ${number} now` };
      expect(forbiddenViolations({ files, pattern: PHONE_NUMBER_LINK_PATTERN })).toHaveLength(1);
    },
  );

  test.each([
    '2026-11-08',
    '2026-11-08 12:30:45',
    'zapbip@0.1.0',
    'sha256 3fa91c0d77aa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071829',
    'v10.4.2-rc.1',
    'port 8787',
  ])('the text %s is not taken for a phone number', (text) => {
    expect(forbiddenViolations({ files: { 'page.mdx': text }, pattern: PHONE_NUMBER_LINK_PATTERN })).toEqual([]);
  });

  test('a planted phone number or official-number snippet in a page is reported', () => {
    const files = { 'get-started/how-to-start.mdx': 'Message +5511999990001 or import /snippets/official-number.mdx' };
    expect(forbiddenViolations({ files, pattern: PHONE_NUMBER_LINK_PATTERN })).toEqual([
      'get-started/how-to-start.mdx: +5511999990001',
      'get-started/how-to-start.mdx: official-number',
    ]);
  });

  test('a typed media figure of 14 days fails naming 30', () => {
    const markdown = `Media is kept ${WRONG_MEDIA_DAYS} days.`;
    expect(retentionFigureViolations({ markdown, kind: DocsRetentionKind.Media })).toEqual(['media: expected 30 days']);
  });
});

describe('docs experience: help', () => {
  test.each(LANGUAGES)('the %s privacy page states every retention figure', (language) => {
    const page = language === DocsLanguage.English ? PRIVACY_PAGE : `${PAGE_LANGUAGE_FOLDER}/${PRIVACY_PAGE}`;
    const markdown = readRepositoryFile(pageFileOf(page));
    const violations = Object.values(DocsRetentionKind).flatMap((kind) => retentionFigureViolations({ markdown, kind }));
    expect(violations).toEqual([]);
  });
});

describe('docs experience: mcp reference', () => {
  test.each(LANGUAGES)('every McpToolName has a %s page and no page is extra', (language) => {
    expect(toolPageViolations({ tools: Object.values(McpToolName), pages: mcpReferencePagesOf({ language }), language })).toEqual([]);
  });

  test('a tool without a page fails', () => {
    const pages = mcpReferencePagesOf({ language: DocsLanguage.English });
    expect(toolPageViolations({ tools: Object.values(McpToolName), pages: pages.slice(1), language: DocsLanguage.English })).toEqual([
      `missing ${pages[0]}`,
    ]);
  });

  test('a page without a tool fails', () => {
    const pages = [...mcpReferencePagesOf({ language: DocsLanguage.English }), EXTRA_TOOL_PAGE];
    expect(toolPageViolations({ tools: Object.values(McpToolName), pages, language: DocsLanguage.English })).toEqual([
      `extra ${EXTRA_TOOL_PAGE}`,
    ]);
  });

  test.each(LANGUAGES)('the %s message kinds table lists every MessageKind', (language) => {
    const snippet = readRepositoryFile(snippetPathOf({ name: MESSAGE_KINDS_SNIPPET, language }));
    expect(messageKindViolations({ snippet, kinds: Object.values(MessageKind) })).toEqual([]);
  });

  test('a table without the sticker kind fails', () => {
    expect(messageKindViolations({ snippet: '| `text` | a |', kinds: [MessageKind.Text, MessageKind.Sticker] })).toEqual([
      'missing sticker',
    ]);
  });
});

const DOCS_CONFIG_FILE = `${DOCS_ROOT}/docs.json`;
const IMAGE_TAG_PATTERN = /<(?:img|Image)\b[^>]*>/g;
const SNIPPET_COMPONENT_EXTENSION = '.jsx';
const IMAGE_SIZE_PATTERN = /\bwidth=(\{?["'`]?\d+)[\s\S]*\bheight=(\{?["'`]?\d+)|\bheight=(\{?["'`]?\d+)[\s\S]*\bwidth=(\{?["'`]?\d+)/;
const PORTUGUESE_ENGLISH_TERM_PATTERN = /\b(job|jobs|merge|merges)\b/gi;
const NOT_FOUND_LINK_PATTERNS = [/\]\(\/\)/, new RegExp(`\\]\\(/${PAGE_LANGUAGE_FOLDER}\\)`)];

type DocsSiteConfig = { favicon?: string; errors?: { 404?: { redirect?: boolean; title?: string; description?: string } } };

function docsSiteConfig(): DocsSiteConfig {
  return JSON.parse(readRepositoryFile(DOCS_CONFIG_FILE));
}

function snippetComponentFiles(): string[] {
  const components = readdirSync(repositoryPath(`${DOCS_ROOT}/${SNIPPETS_DIRECTORY}`)).filter((name) =>
    name.endsWith(SNIPPET_COMPONENT_EXTENSION),
  );
  const pages = documentFiles(SNIPPETS_DIRECTORY);
  return [...components.map((name) => `${SNIPPETS_DIRECTORY}/${name}`), ...pages].map((path) => `${DOCS_ROOT}/${path}`);
}

function unsizedImages({ markdown }: { markdown: string }): string[] {
  return [...markdown.matchAll(IMAGE_TAG_PATTERN)].map((match) => match[0]).filter((tag) => !IMAGE_SIZE_PATTERN.test(tag));
}

describe('docs experience: site polish', () => {
  test('docs.json sets a favicon that is a file committed in apps/docs', () => {
    const { favicon } = docsSiteConfig();
    expect(favicon).toBeTypeOf('string');
    expect(existsSync(repositoryPath(`${DOCS_ROOT}${favicon}`))).toBe(true);
  });

  test('every image in the docs reserves its space with a width and a height', () => {
    const files = [...pageEntries.map(pageFileOf), ...snippetComponentFiles()];
    const violations = files.flatMap((file) => unsizedImages({ markdown: readRepositoryFile(file) }).map((tag) => `${file}: ${tag}`));
    expect(violations).toEqual([]);
  });

  test('an Image component without a height fails', () => {
    expect(unsizedImages({ markdown: '<Image src="/a.svg" width="420" />' })).toHaveLength(1);
  });

  test('an image tag without a height fails', () => {
    expect(unsizedImages({ markdown: '<img src="/a.svg" width="420" />' })).toHaveLength(1);
  });

  test('the pt-br pages use no English job or merge', () => {
    const files = Object.fromEntries(
      pageEntries
        .filter((page) => languageOf(page) === DocsLanguage.PortugueseBrazil)
        .map((page) => [page, readRepositoryFile(pageFileOf(page))]),
    );
    expect(forbiddenViolations({ files, pattern: PORTUGUESE_ENGLISH_TERM_PATTERN })).toEqual([]);
  });

  test('docs.json shows a custom 404 that links the Overview of both languages', () => {
    const notFound = docsSiteConfig().errors?.[404];
    const description = notFound?.description;
    if (!notFound || !description) throw new Error('docs.json has no errors.404 description');
    expect(notFound.redirect).toBe(false);
    expect(notFound.title).toBeTruthy();
    expect(NOT_FOUND_LINK_PATTERNS.filter((pattern) => !pattern.test(description))).toEqual([]);
  });
});
