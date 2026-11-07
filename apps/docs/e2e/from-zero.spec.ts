import { expect, test, type Page } from '@playwright/test';
import { DocsLanguage, DocsOnlyClient, InstallClient, OFFICIAL_WHATSAPP_NUMBER, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { AGENT_PAGE_HEADINGS, AGENT_PAGE_SECTIONS, type DocsAgentClient } from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DOCS_WALK_NOISE_ALLOWLIST, DocsViewport, docsOptionsOf } from './support/docs-experience';

const FIRST_ERROR_STATUS = 400;
const OVERVIEW_PATH = 'index';
const GET_STARTED_PATH = 'get-started/how-to-start';
const MATRIX_PATH = 'agents/supported-agents';
const ZERO_WIDTH_SPACE = /​/g;
const NOT_FOUND_PATTERN = /Page Not Found|Página não encontrada/i;
const ASSET_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;
const VISIBLE_LINK_LOCATOR = '#content-area a:not([aria-hidden])';
const WALK_TIMEOUT_MS = 300_000;
const INTERNAL_LINK_LOCATOR = '#content-area a[href^="/"]';
const MATRIX_LINK_LOCATOR = '#content-area table tbody tr a[href*="agents/"]';
const NUMBER_LINK = `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}`;
const NUMBER_TEXT = `+${OFFICIAL_WHATSAPP_NUMBER}`;
const MATRIX_CLIENTS: DocsAgentClient[] = [...Object.values(InstallClient), ...Object.values(DocsOnlyClient)];
const STEP_COUNT = 5;

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/${input.path}`;
}

function pathOf(input: { href: string }): string {
  return new URL(input.href, 'http://docs.local').pathname;
}

function isInLanguageFolder(input: { path: string }): boolean {
  return input.path === `/${PAGE_LANGUAGE_FOLDER}` || input.path.startsWith(`/${PAGE_LANGUAGE_FOLDER}/`);
}

function isAllowedNoise(input: { entry: string }): boolean {
  return DOCS_WALK_NOISE_ALLOWLIST.some((allowed) => allowed.pattern.test(input.entry));
}

async function expectNoOverflow(input: { page: Page }): Promise<void> {
  const overflow = await input.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function internalLinksOf(input: { page: Page }): Promise<string[]> {
  const hrefs = await input.page
    .locator(INTERNAL_LINK_LOCATOR)
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
  const paths = hrefs.map((href) => pathOf({ href: String(href) }));
  return paths.filter((path) => !ASSET_EXTENSION_PATTERN.test(path));
}

for (const language of Object.values(DocsLanguage)) {
  for (const viewport of Object.values(DocsViewport)) {
    test.describe(`from zero in ${language} at ${viewport}`, () => {
      test.use(docsOptionsOf({ language, viewport }));
      test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
      });

      test(`${DOCS_LOCALE_OF[language]} walk from the Overview to the WhatsApp step`, async ({ page }) => {
        test.setTimeout(WALK_TIMEOUT_MS);
        const noise: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') noise.push(`console ${message.text()}`);
        });
        page.on('pageerror', (error) => noise.push(`pageerror ${error.message}`));
        page.on('requestfailed', (request) => noise.push(`requestfailed ${request.url()}`));
        page.on('response', (response) => {
          if (response.status() >= FIRST_ERROR_STATUS) noise.push(`response ${response.status()} ${response.url()}`);
        });
        const visitedLinks = new Set<string>();

        await page.goto(urlOf({ path: OVERVIEW_PATH, language }));
        await expect(page.locator('#content-area h1, #content-area h2').first()).toBeVisible();
        await expectNoOverflow({ page });
        (await internalLinksOf({ page })).forEach((path) => visitedLinks.add(path));

        await page.locator(`${VISIBLE_LINK_LOCATOR}[href$="${GET_STARTED_PATH}"]`).first().click();
        await expect(page).toHaveURL(new RegExp(`${GET_STARTED_PATH}$`));
        const steps = page.locator('#content-area ol > li');
        await expect(steps).toHaveCount(STEP_COUNT);
        for (let position = 0; position < STEP_COUNT; position += 1) await expect(steps.nth(position)).toBeVisible();
        await expect(steps.first().locator(`a[href="${NUMBER_LINK}"]`)).toBeVisible();
        await expect(steps.first()).toContainText(NUMBER_TEXT);
        await expectNoOverflow({ page });
        (await internalLinksOf({ page })).forEach((path) => visitedLinks.add(path));

        await page.locator(`${VISIBLE_LINK_LOCATOR}[href$="${MATRIX_PATH}"]`).first().click();
        await expect(page).toHaveURL(new RegExp(`${MATRIX_PATH}$`));
        await expect(page.locator(MATRIX_LINK_LOCATOR)).toHaveCount(MATRIX_CLIENTS.length);
        const matrixHrefs = await page
          .locator(MATRIX_LINK_LOCATOR)
          .evaluateAll((anchors) => anchors.map((anchor) => String(anchor.getAttribute('href'))));
        const agentPaths = matrixHrefs.map((href) => pathOf({ href }));
        (await internalLinksOf({ page })).forEach((path) => visitedLinks.add(path));

        const expectedHeadings = AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[language][section]);
        for (const agentPath of agentPaths) {
          const response = await page.goto(agentPath);
          expect(response?.status(), agentPath).toBeLessThan(FIRST_ERROR_STATUS);
          await expect(page.locator('#content-area h2').first()).toBeAttached();
          const headings = await page.locator('#content-area h2').allInnerTexts();
          const headingTexts = headings.map((heading) => heading.replace(ZERO_WIDTH_SPACE, '').trim());
          expect(
            headingTexts.filter((heading) => expectedHeadings.includes(heading)),
            agentPath,
          ).toEqual(expectedHeadings);
          await expectNoOverflow({ page });
          (await internalLinksOf({ page })).forEach((path) => visitedLinks.add(path));
        }

        for (const linkedPath of visitedLinks) {
          const response = await page.goto(linkedPath);
          expect(response?.status(), linkedPath).toBeLessThan(FIRST_ERROR_STATUS);
          await expect(page.locator('#content-area h1').first(), linkedPath).toBeVisible();
          await expect(page.locator('#content-area'), linkedPath).not.toContainText(NOT_FOUND_PATTERN);
          if (language === DocsLanguage.PortugueseBrazil) expect(isInLanguageFolder({ path: linkedPath }), linkedPath).toBe(true);
          await expectNoOverflow({ page });
        }

        expect(noise.filter((entry) => !isAllowedNoise({ entry }))).toEqual([]);
      });
    });
  }
}
