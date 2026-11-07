import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { DocsLanguage, DocsOnlyClient, InstallClient } from '@zapbip/types';
import {
  AGENT_PAGE_HEADINGS,
  AGENT_PAGE_SECTIONS,
  CLIENT_LISTEN_FACTS,
  LISTEN_STATEMENT_TOKENS,
  WAKE_RUNG_LABELS,
  type DocsAgentClient,
} from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const PAGE_LANGUAGE_FOLDER = 'pt-br';
const OK_STATUS = 200;
const ONE_HOUR_SECONDS = 3600;
const ZERO_WIDTH_SPACE = /​/g;
const CHAT_SELECTOR = '#content-area [role="group"][aria-label^="WhatsApp"]';
const MATRIX_PAGE = 'agents/supported-agents';
const MATRIX_ROW_SELECTOR = '#content-area table tbody tr';
const BACKGROUND_RUNNING_PATH = 'developers/background-running';
const CONNECTOR_PACKAGE_FILE = '../connector/package.json';
const CLAUDE_CODE_CHANNEL_COMMAND = 'claude --dangerously-load-development-channels server:zapbip-channel';
const CODEX_TOOL_TIMEOUT_SECONDS = '900';
const CLIENTS_A = [InstallClient.ClaudeCode, InstallClient.Codex, InstallClient.ClaudeAi, InstallClient.ChatGpt, InstallClient.Cursor];
const MATRIX_CLIENTS: DocsAgentClient[] = [...Object.values(InstallClient), ...Object.values(DocsOnlyClient)];
const SECONDS_WORD: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'seconds',
  [DocsLanguage.PortugueseBrazil]: 'segundos',
};
const HOURLY_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'hour',
  [DocsLanguage.PortugueseBrazil]: 'hora',
};
const SAFETY_NET_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'safety net',
  [DocsLanguage.PortugueseBrazil]: 'rede de segurança',
};
const TOOL_TIMEOUT_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'one call',
  [DocsLanguage.PortugueseBrazil]: 'uma chamada',
};
const PENDING_SECONDS_TOKEN = '50';

const connectorVersion: string = JSON.parse(readFileSync(CONNECTOR_PACKAGE_FILE, 'utf8')).version;
const LISTEN_COMMAND = `npx zapbip@${connectorVersion} listen`;

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/${input.path}`;
}

function delayTokenOf(input: { expectedDelaySeconds: number; language: DocsLanguage }): string {
  if (input.expectedDelaySeconds === ONE_HOUR_SECONDS) return HOURLY_TOKEN[input.language];
  return `${input.expectedDelaySeconds} ${SECONDS_WORD[input.language]}`;
}

function agentUrlOf(input: { client: DocsAgentClient; language: DocsLanguage }): string {
  return urlOf({ path: `agents/${input.client}`, language: input.language });
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`agents A in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    for (const client of CLIENTS_A) {
      test.describe(client, () => {
        test('shows the four headings in order and at least one conversation', async ({ page }) => {
          const response = await page.goto(agentUrlOf({ client, language }));
          expect(response?.status()).toBe(OK_STATUS);
          const headings = await page.locator('#content-area h2').allInnerTexts();
          const headingTexts = headings.map((heading) => heading.replace(ZERO_WIDTH_SPACE, '').trim());
          const expected = AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[language][section]);
          expect(headingTexts.filter((heading) => expected.includes(heading))).toEqual(expected);
          await expect(page.locator(CHAT_SELECTOR).first()).toBeVisible();
        });

        test('states the rung, the expected delay and the listen loop', async ({ page }) => {
          await page.goto(agentUrlOf({ client, language }));
          const content = page.locator('#content-area');
          const { rung, expectedDelaySeconds } = CLIENT_LISTEN_FACTS[client];
          await expect(content).toContainText(WAKE_RUNG_LABELS[language][rung], { ignoreCase: true });
          if (expectedDelaySeconds !== null)
            await expect(content).toContainText(delayTokenOf({ expectedDelaySeconds, language }), { ignoreCase: true });
          await expect(content).toContainText(PENDING_SECONDS_TOKEN);
          for (const token of Object.values(LISTEN_STATEMENT_TOKENS[language]))
            await expect(content).toContainText(token, { ignoreCase: true });
        });
      });
    }

    test('claude-code names the channel flag and links background running', async ({ page }) => {
      await page.goto(agentUrlOf({ client: InstallClient.ClaudeCode, language }));
      await expect(page.locator('#content-area')).toContainText(CLAUDE_CODE_CHANNEL_COMMAND);
      await expect(page.locator(`#content-area a[href$="${BACKGROUND_RUNNING_PATH}"]`).first()).toBeVisible();
    });

    test('codex says the tool timeout bounds one call and links background running', async ({ page }) => {
      await page.goto(agentUrlOf({ client: InstallClient.Codex, language }));
      const content = page.locator('#content-area');
      await expect(content).toContainText(CODEX_TOOL_TIMEOUT_SECONDS);
      await expect(content).toContainText(TOOL_TIMEOUT_TOKEN[language], { ignoreCase: true });
      await expect(page.locator(`#content-area a[href$="${BACKGROUND_RUNNING_PATH}"]`).first()).toBeVisible();
    });

    test('claude-ai names the hourly safety net', async ({ page }) => {
      await page.goto(agentUrlOf({ client: InstallClient.ClaudeAi, language }));
      const content = page.locator('#content-area');
      await expect(content).toContainText(HOURLY_TOKEN[language], { ignoreCase: true });
      await expect(content).toContainText(SAFETY_NET_TOKEN[language], { ignoreCase: true });
    });

    test('cursor names the listen command in a background terminal', async ({ page }) => {
      await page.goto(agentUrlOf({ client: InstallClient.Cursor, language }));
      await expect(page.locator('#content-area')).toContainText(LISTEN_COMMAND);
    });

    test('supported agents has one linked row per client and a page for each link', async ({ page }) => {
      await page.goto(urlOf({ path: MATRIX_PAGE, language }));
      await expect(page.locator(MATRIX_ROW_SELECTOR)).toHaveCount(MATRIX_CLIENTS.length);
      for (const client of MATRIX_CLIENTS) {
        const link = page.locator(`${MATRIX_ROW_SELECTOR} a[href$="agents/${client}"]`);
        await expect(link).toHaveCount(1);
      }
    });
  });
}
