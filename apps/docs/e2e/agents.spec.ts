import { expect, test, type Locator } from '@playwright/test';
import { DocsLanguage, INSTALL_SELF_TEST_TEXT, OwnerLocale, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { ConnectorClient } from '../../../libs/agents/src/connector';
import { AGENT_DEFINITIONS, AgentId } from '../../../libs/agents/src/definitions';
import { AGENT_INSTALLS } from '../../../libs/agents/src/install';
import { AGENT_PLUGINS } from '../../../libs/agents/src/plugins';
import {
  AGENT_PAGE_HEADINGS,
  AGENT_PAGE_SECTIONS,
  LISTEN_STATEMENT_TOKENS,
  WAKE_RUNG_LABELS,
} from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const OK_STATUS = 200;
const ONE_HOUR_SECONDS = 3600;
const ZERO_WIDTH_SPACE = /​/g;
const CONTENT_SELECTOR = '#content-area';
const CHAT_SELECTOR = `${CONTENT_SELECTOR} [role="group"][aria-label^="WhatsApp"]`;
const MATRIX_PAGE = 'agents/supported-agents';
const MATRIX_ROW_SELECTOR = `${CONTENT_SELECTOR} table tbody tr`;
const BACKGROUND_RUNNING_PATH = 'developers/background-running';
const PENDING_SECONDS_TOKEN = '50';
const LINK_FACT_PREFIX = '/';
const SECONDS_WORD: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'seconds',
  [DocsLanguage.PortugueseBrazil]: 'segundos',
};
const HOURLY_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'hour',
  [DocsLanguage.PortugueseBrazil]: 'hora',
};
const OWNER_LOCALE_OF: Record<DocsLanguage, OwnerLocale> = {
  [DocsLanguage.English]: OwnerLocale.EnglishUs,
  [DocsLanguage.PortugueseBrazil]: OwnerLocale.PortugueseBrazil,
};

const agentIds: AgentId[] = Object.values(AgentId);
const connectorIds: string[] = Object.values(ConnectorClient);

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/${input.path}`;
}

function delayTokenOf(input: { expectedDelaySeconds: number; language: DocsLanguage }): string {
  if (input.expectedDelaySeconds === ONE_HOUR_SECONDS) return HOURLY_TOKEN[input.language];
  return `${input.expectedDelaySeconds} ${SECONDS_WORD[input.language]}`;
}

async function expectFactVisible(input: { content: Locator; fact: string }): Promise<void> {
  if (input.fact.startsWith(LINK_FACT_PREFIX)) return expect(input.content.locator(`a[href$="${input.fact}"]`).first()).toBeVisible();
  return expect(input.content).toContainText(input.fact, { ignoreCase: true });
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`agents in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    for (const id of agentIds) {
      const { listen, docs } = AGENT_DEFINITIONS[id];
      const plugin = Object.entries(AGENT_PLUGINS).find(([pluginId]) => pluginId === id)?.[1];
      test.describe(id, () => {
        test('shows the four headings in order and at least one conversation', async ({ page }) => {
          const response = await page.goto(urlOf({ path: `agents/${id}`, language }));
          expect(response?.status()).toBe(OK_STATUS);
          await expect(page.locator(`${CONTENT_SELECTOR} h2`).first()).toBeAttached();
          const headings = await page.locator(`${CONTENT_SELECTOR} h2`).allInnerTexts();
          const headingTexts = headings.map((heading) => heading.replace(ZERO_WIDTH_SPACE, '').trim());
          const expected = AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[language][section]);
          expect(headingTexts.filter((heading) => expected.includes(heading))).toEqual(expected);
          await expect(page.locator(CHAT_SELECTOR).first()).toBeVisible();
        });

        test('states the rung, the expected delay and the listen loop', async ({ page }) => {
          await page.goto(urlOf({ path: `agents/${id}`, language }));
          const content = page.locator(CONTENT_SELECTOR);
          await expect(content).toContainText(WAKE_RUNG_LABELS[language][listen.rung], { ignoreCase: true });
          if (listen.expectedDelaySeconds !== null)
            await expect(content).toContainText(delayTokenOf({ expectedDelaySeconds: listen.expectedDelaySeconds, language }), {
              ignoreCase: true,
            });
          await expect(content).toContainText(PENDING_SECONDS_TOKEN);
          for (const token of Object.values(LISTEN_STATEMENT_TOKENS[language]))
            await expect(content).toContainText(token, { ignoreCase: true });
        });

        test('shows every fact its definition names', async ({ page }) => {
          await page.goto(urlOf({ path: `agents/${id}`, language }));
          for (const fact of docs.pageFacts[language]) await expectFactVisible({ content: page.locator(CONTENT_SELECTOR), fact });
        });

        if (id in AGENT_INSTALLS)
          test('asks the agent to send the self-test text', async ({ page }) => {
            await page.goto(urlOf({ path: `agents/${id}`, language }));
            await expect(page.locator(CONTENT_SELECTOR)).toContainText(INSTALL_SELF_TEST_TEXT[OWNER_LOCALE_OF[language]]);
          });

        if (plugin)
          test('prints the plugin install command', async ({ page }) => {
            await page.goto(urlOf({ path: `agents/${id}`, language }));
            await expect(page.locator(CONTENT_SELECTOR)).toContainText(plugin.installCommand);
          });

        if (connectorIds.includes(id))
          test('links background running', async ({ page }) => {
            await page.goto(urlOf({ path: `agents/${id}`, language }));
            await expect(page.locator(`${CONTENT_SELECTOR} a[href$="${BACKGROUND_RUNNING_PATH}"]`).first()).toBeVisible();
          });
      });
    }

    test('supported agents has one linked row per client and a page for each link', async ({ page }) => {
      await page.goto(urlOf({ path: MATRIX_PAGE, language }));
      await expect(page.locator(MATRIX_ROW_SELECTOR)).toHaveCount(agentIds.length);
      for (const id of agentIds) await expect(page.locator(`${MATRIX_ROW_SELECTOR} a[href$="agents/${id}"]`)).toHaveCount(1);
    });
  });
}
