import { expect, test } from '@playwright/test';
import { DocsLanguage, DocsOnlyClient, InstallClient, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { HERMES_INSTALL_COMMAND } from '../../../libs/agents/src/plugins';
import {
  AGENT_PAGE_HEADINGS,
  AGENT_PAGE_SECTIONS,
  AgentPageSection,
  CLIENT_LISTEN_FACTS,
  type DocsAgentClient,
  LISTEN_STATEMENT_TOKENS,
  WAKE_RUNG_LABELS,
} from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const OK_STATUS = 200;
const CONTENT_SELECTOR = '#content-area';
const ZERO_WIDTH_SPACE = /\u200B/g;
const PENDING_LOOP_SECONDS = '50';
const GROK_WEB_CALL_CAP_SECONDS = '60';
const BACKGROUND_TERMINAL_COMMAND = 'npx zapbip@0.1.0 listen';
const ANY_MCP_CLIENT_LINK = '/developers/any-mcp-client';
const CHECK_INBOX_TOOL = 'check_inbox';
const AGENT_CLIENTS: DocsAgentClient[] = [
  InstallClient.GrokBot,
  InstallClient.GrokWeb,
  InstallClient.Hermes,
  InstallClient.OpenClaw,
  InstallClient.GeminiCli,
  DocsOnlyClient.AnyMcpClient,
];
const BACKGROUND_TERMINAL_WORDS: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'background terminal',
  [DocsLanguage.PortugueseBrazil]: 'terminal em segundo plano',
};
const GROK_WEB_STANDBY_WORDS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Grok Bot', 'stands in', GROK_WEB_CALL_CAP_SECONDS],
  [DocsLanguage.PortugueseBrazil]: ['Grok Bot', 'atende no lugar', GROK_WEB_CALL_CAP_SECONDS],
};
const PLUGIN_COMMAND_OF: Partial<Record<DocsAgentClient, string>> = {
  [InstallClient.Hermes]: HERMES_INSTALL_COMMAND,
  [InstallClient.OpenClaw]: 'openclaw plugins install @zapbip/openclaw-plugin@0.1.0 --force --accept-capabilities',
};
const CONNECTION_FILE_MODE_COMMAND = 'chmod 600';

function urlOf(input: { client: DocsAgentClient; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/agents/${input.client}`;
  return `/${PAGE_LANGUAGE_FOLDER}/agents/${input.client}`;
}

function sectionOf(input: { content: string; language: DocsLanguage; section: AgentPageSection }): string {
  const headings = AGENT_PAGE_HEADINGS[input.language];
  const start = input.content.indexOf(headings[input.section]);
  const next = AGENT_PAGE_SECTIONS[AGENT_PAGE_SECTIONS.indexOf(input.section) + 1];
  const end = next === undefined ? input.content.length : input.content.indexOf(headings[next]);
  return input.content.slice(start, end);
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`agent pages B in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    test('grok-bot, grok-web, hermes, openclaw, gemini-cli, any-mcp-client show the four sections in order', async ({ page }) => {
      for (const client of AGENT_CLIENTS) {
        const response = await page.goto(urlOf({ client, language }));
        expect(response?.status()).toBe(OK_STATUS);
        await expect(page.locator(`${CONTENT_SELECTOR} h2`).first()).toBeAttached();
        const headings = await page.locator(`${CONTENT_SELECTOR} h2`).allTextContents();
        expect(headings.map((heading) => heading.replace(ZERO_WIDTH_SPACE, '').trim())).toEqual(
          AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[language][section]),
        );
      }
    });

    for (const client of AGENT_CLIENTS) {
      test(`${client} states its rung, the pending loop, the re-call and no time limit`, async ({ page }) => {
        await page.goto(urlOf({ client, language }));
        const content = await page.locator(CONTENT_SELECTOR).innerText();
        const listens = sectionOf({ content, language, section: AgentPageSection.HowItListens }).toLowerCase();
        const facts = CLIENT_LISTEN_FACTS[client];
        const delayWords = facts.expectedDelaySeconds === null ? [] : [String(facts.expectedDelaySeconds)];
        const expectedWords = [
          WAKE_RUNG_LABELS[language][facts.rung],
          PENDING_LOOP_SECONDS,
          ...Object.values(LISTEN_STATEMENT_TOKENS[language]),
          ...delayWords,
        ];
        for (const word of expectedWords) expect(listens).toContain(word.toLowerCase());
      });
    }

    test('grok-web says a Grok Bot stands in and that the 60 second cap is the reason', async ({ page }) => {
      await page.goto(urlOf({ client: InstallClient.GrokWeb, language }));
      for (const word of GROK_WEB_STANDBY_WORDS[language]) await expect(page.locator(CONTENT_SELECTOR)).toContainText(word);
    });

    test('gemini-cli names the listen command in a code block and the background terminal', async ({ page }) => {
      await page.goto(urlOf({ client: InstallClient.GeminiCli, language }));
      await expect(page.locator(`${CONTENT_SELECTOR} pre`).filter({ hasText: BACKGROUND_TERMINAL_COMMAND }).first()).toBeVisible();
      await expect(page.locator(CONTENT_SELECTOR)).toContainText(BACKGROUND_TERMINAL_WORDS[language]);
    });

    for (const [client, command] of Object.entries(PLUGIN_COMMAND_OF)) {
      test(`${client} gives the plugin install, the file mode and the scheduled fallback`, async ({ page }) => {
        await page.goto(urlOf({ client: client as DocsAgentClient, language }));
        for (const token of [command, CONNECTION_FILE_MODE_COMMAND, CHECK_INBOX_TOOL]) {
          await expect(page.locator(CONTENT_SELECTOR)).toContainText(token);
        }
      });
    }

    test('any-mcp-client states the loop and check_inbox', async ({ page }) => {
      await page.goto(urlOf({ client: DocsOnlyClient.AnyMcpClient, language }));
      const content = await page.locator(CONTENT_SELECTOR).innerText();
      const listens = sectionOf({ content, language, section: AgentPageSection.HowItListens });
      expect(listens).toContain(CHECK_INBOX_TOOL);
    });

    test('any-mcp-client links to /developers/any-mcp-client', async ({ page }) => {
      await page.goto(urlOf({ client: DocsOnlyClient.AnyMcpClient, language }));
      const prefix = language === DocsLanguage.English ? '' : `/${PAGE_LANGUAGE_FOLDER}`;
      const link = page.locator(`${CONTENT_SELECTOR} a[href="${prefix}${ANY_MCP_CLIENT_LINK}"]`).first();
      await expect(link).toBeVisible();
      const response = await page.request.get(`${prefix}${ANY_MCP_CLIENT_LINK}`);
      expect(response.status()).toBe(OK_STATUS);
    });
  });
}
