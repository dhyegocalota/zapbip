import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  DocsLanguage,
  DocsOnlyClient,
  DocsRetentionKind,
  InstallClient,
  McpToolName,
  MessageKind,
  OFFICIAL_NUMBER_UNSET,
  OFFICIAL_WHATSAPP_NUMBER,
} from '@zapbip/types';
import {
  AGENT_PAGE_HEADINGS,
  AGENT_PAGE_SECTIONS,
  AgentPageSection,
  CHAT_MAX_MESSAGES,
  DOCS_GROUPS,
  INSTALL_PROMPT_MAX_LINES,
  PAGE_LANGUAGE_FOLDER,
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
  type DocsAgentClient,
} from './docs-experience';
import { DOCS_ROOT, PAGE_EXTENSION, capturedNames, documentFiles, readRepositoryFile, repositoryPath } from './repository-files';

const SNIPPETS_DIRECTORY = 'snippets';
const AGENTS_DIRECTORY = 'agents';
const MATRIX_PAGE = 'agents/supported-agents';
const INSTALL_PROMPT_SNIPPET = 'install-prompt';
const OFFICIAL_NUMBER_SNIPPET = 'official-number';
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
const OFFICIAL_NUMBER_PATTERN = new RegExp(`^(${OFFICIAL_NUMBER_UNSET}|\\d+)$`);
const MATRIX_LINK_PATTERN = /\]\(\/(?:pt-br\/)?agents\/([a-z-]+)\)/g;
const TABLE_ROW_PATTERN = /^\|/;
const TABLE_HEADER_ROW_COUNT = 2;
const TEST_NUMBER = '15550000001';
const OTHER_TEST_NUMBER = '15550000002';
const NEW_CLIENT_PAGE = 'agents/x';
const DOCS_ONLY_PAGE_NAMES = ['cursor', 'gemini-cli', 'any-mcp-client'];
const WRONG_MEDIA_DAYS = 14;
const PRIVACY_PAGE = 'help/privacy-and-security';
const MCP_REFERENCE_FOLDER = 'mcp-reference';
const MESSAGE_KINDS_SNIPPET = 'message-kinds';
const TOOL_NAME_SEPARATOR = '_';
const PAGE_NAME_SEPARATOR = '-';
const EXTRA_TOOL_PAGE = 'mcp-reference/not-a-tool';
const FIRST_CELL_PATTERN = /^\|\s*`([a-z]+)`/g;

const LANGUAGES = Object.values(DocsLanguage);
const CLIENTS: DocsAgentClient[] = [...Object.values(InstallClient), ...Object.values(DocsOnlyClient)];
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

function missingAgentPages({ clients, pageExists }: { clients: DocsAgentClient[]; pageExists: (page: string) => boolean }): string[] {
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

function officialNumberViolations({ snippet, number }: { snippet: string; number: string }): string[] {
  const isValidNumber = OFFICIAL_NUMBER_PATTERN.test(number);
  const expectedTokens = [`+${number}`, `https://wa.me/${number}`];
  const missing = expectedTokens.filter((token) => !snippet.includes(token)).map((token) => `missing ${token}`);
  return isValidNumber ? missing : [`invalid number ${number}`, ...missing];
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
    expect(missingAgentPages({ clients: [InstallClient.Cursor], pageExists: () => false })).toEqual([
      'agents/cursor',
      'pt-br/agents/cursor',
    ]);
  });

  test.each(LANGUAGES)('the matrix has exactly one row per client in %s', (language) => {
    const matrixPage = twinPathOf({ path: MATRIX_PAGE, language });
    const markdown = readRepositoryFile(pageFileOf(matrixPage));
    const rows = markdown.split(LINE_SEPARATOR).filter((line) => TABLE_ROW_PATTERN.test(line)).length - TABLE_HEADER_ROW_COUNT;
    expect(rows).toBe(CLIENTS.length);
    expect(matrixClientsOf({ markdown }).sort()).toEqual([...CLIENTS].sort());
  });

  test.each(LANGUAGES)('Cursor, Gemini CLI and any MCP client appear in the navigation and as pages in %s', (language) => {
    const listed = navigationPagesOf({ language });
    const expected = DOCS_ONLY_PAGE_NAMES.map((name) => twinPathOf({ path: `${AGENTS_DIRECTORY}/${name}`, language }));
    expect(listed.filter((page) => expected.includes(page)).sort()).toEqual([...expected].sort());
    expect(expected.filter((page) => !existsSync(repositoryPath(pageFileOf(page))))).toEqual([]);
  });

  test('an agent page with no matrix row fails naming it', () => {
    expect(unmatrixedAgentPages({ matrixClients: ['codex'], pages: ['codex', NEW_CLIENT_PAGE] })).toEqual([NEW_CLIENT_PAGE]);
  });

  test('every agent page has no page without a matrix row', () => {
    const pages = documentFiles(AGENTS_DIRECTORY).map((path) => withoutExtension(path).replace(`${AGENTS_DIRECTORY}/`, ''));
    const matrixClients = matrixClientsOf({ markdown: readRepositoryFile(pageFileOf(MATRIX_PAGE)) });
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
      developerLinkViolations({ page: 'agents/claude-ai', links: ['/developers/any-mcp-client', '/developers/local-connector'] }),
    ).toEqual(['agents/claude-ai -> /developers/local-connector']);
  });

  test('background running is allowed on Claude Code and Codex only, in both languages', () => {
    expect(developerLinkViolations({ page: 'agents/codex', links: ['/developers/background-running'] })).toEqual([]);
    expect(developerLinkViolations({ page: 'agents/claude-ai', links: ['/developers/background-running'] })).toEqual([
      'agents/claude-ai -> /developers/background-running',
    ]);
    expect(developerLinkViolations({ page: 'pt-br/agents/claude-code', links: ['/pt-br/developers/background-running'] })).toEqual([]);
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

  test.each(LANGUAGES)('the official number snippet in %s renders the constant', (language) => {
    const snippet = readRepositoryFile(snippetPathOf({ name: OFFICIAL_NUMBER_SNIPPET, language }));
    expect(officialNumberViolations({ snippet, number: OFFICIAL_WHATSAPP_NUMBER })).toEqual([]);
  });

  test('a snippet digit that differs from the constant fails', () => {
    const snippet = `+${TEST_NUMBER} https://wa.me/${TEST_NUMBER}`;
    expect(officialNumberViolations({ snippet, number: OTHER_TEST_NUMBER })).toEqual([
      `missing +${OTHER_TEST_NUMBER}`,
      `missing https://wa.me/${OTHER_TEST_NUMBER}`,
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
