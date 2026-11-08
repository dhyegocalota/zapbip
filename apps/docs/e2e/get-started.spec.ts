import { expect, test } from '@playwright/test';
import { DocsLanguage, PAGE_LANGUAGE_FOLDER, START_LINK, START_LINK_LANGUAGE_PARAMETER } from '@zapbip/types';
import { CHAT_MAX_MESSAGES } from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const OK_STATUS = 200;
const OVERVIEW_PAGE = 'index';
const GET_STARTED_PAGE = 'get-started/how-to-start';
const FOOTER_LABEL = 'zapbip · Logic Bit';
const COMING_SOON_PATTERN = /coming soon|em breve/i;
const WHATSAPP_NUMBER_LINK_LOCATOR = 'a[href*="wa.me"]';
const PHONE_NUMBER_PATTERN = /\+\d{7,}/;
const INSTALL_PROMPT_PLACEHOLDER = 'zb_inst_<code>';
const OVERVIEW_EXAMPLE_COUNT = { minimum: 3, maximum: 5 };
const OVERVIEW_HEADING_COUNT = 3;
const ZERO_WIDTH_SPACE = /​/g;
const MESSAGE_BUBBLES_LOCATOR = ':scope > div:nth-child(2) > div';
const OVERVIEW_HEADINGS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Why zapbip exists', 'How it works', 'What it looks like'],
  [DocsLanguage.PortugueseBrazil]: ['Por que o zapbip existe', 'Como funciona', 'Como fica'],
};
const PICTURE_ALT_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'Your AI connects to zapbip',
  [DocsLanguage.PortugueseBrazil]: 'Sua IA se conecta ao zapbip',
};

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/${input.path}`;
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`get started in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    test('the Overview shows why, how it works and the examples in that order', async ({ page }) => {
      const response = await page.goto(urlOf({ path: OVERVIEW_PAGE, language }));
      expect(response?.status()).toBe(OK_STATUS);
      await expect(page.locator('#content-area h2').first()).toBeAttached();
      const headings = await page.locator('#content-area h2').allInnerTexts();
      const headingTexts = headings.map((heading) => heading.replace(ZERO_WIDTH_SPACE, '').trim());
      expect(headingTexts.slice(0, OVERVIEW_HEADING_COUNT)).toEqual(OVERVIEW_HEADINGS[language]);
      await expect(page.locator('#content-area')).not.toContainText(COMING_SOON_PATTERN);
    });

    test('the Overview picture loads and describes the flow in the page language', async ({ page }) => {
      await page.goto(urlOf({ path: OVERVIEW_PAGE, language }));
      const picture = page.locator('#content-area img[src*="how-it-works"]');
      await expect(picture).toBeVisible();
      await expect(picture).toHaveAttribute('alt', new RegExp(PICTURE_ALT_TOKEN[language]));
      const source = await picture.getAttribute('src');
      const pictureResponse = await page.request.get(String(source));
      expect(pictureResponse.status()).toBe(OK_STATUS);
    });

    test('the Overview has three or four examples and each chat has at most four messages', async ({ page }) => {
      await page.goto(urlOf({ path: OVERVIEW_PAGE, language }));
      const chats = page.getByRole('group', { name: /WhatsApp/ });
      await expect(chats.first()).toBeVisible();
      const chatCount = await chats.count();
      expect(chatCount).toBeGreaterThanOrEqual(OVERVIEW_EXAMPLE_COUNT.minimum);
      expect(chatCount).toBeLessThanOrEqual(OVERVIEW_EXAMPLE_COUNT.maximum);
      for (let position = 0; position < chatCount; position += 1) {
        const messageCount = await chats.nth(position).locator(MESSAGE_BUBBLES_LOCATOR).count();
        expect(messageCount).toBeLessThanOrEqual(CHAT_MAX_MESSAGES);
      }
    });

    test('Get started is one ordered list with the start link and the prompt', async ({ page }) => {
      await page.goto(urlOf({ path: GET_STARTED_PAGE, language }));
      const content = page.locator('#content-area');
      await expect(content.locator('ol')).toHaveCount(1);
      await expect(content.locator(`a[href="${START_LINK}?${START_LINK_LANGUAGE_PARAMETER}=${language}"]`).first()).toBeVisible();
      await expect(page.locator(WHATSAPP_NUMBER_LINK_LOCATOR)).toHaveCount(0);
      await expect(content).not.toContainText(PHONE_NUMBER_PATTERN);
      await expect(content.locator('code', { hasText: INSTALL_PROMPT_PLACEHOLDER }).first()).toBeVisible();
      await expect(content).not.toContainText(COMING_SOON_PATTERN);
    });

    test('Get started chats have at most four messages and the footer names Logic Bit', async ({ page }) => {
      await page.goto(urlOf({ path: GET_STARTED_PAGE, language }));
      const chats = page.getByRole('group', { name: /WhatsApp/ });
      await expect(chats.first()).toBeVisible();
      const chatCount = await chats.count();
      for (let position = 0; position < chatCount; position += 1) {
        const messageCount = await chats.nth(position).locator(MESSAGE_BUBBLES_LOCATOR).count();
        expect(messageCount).toBeLessThanOrEqual(CHAT_MAX_MESSAGES);
      }
      await expect(page.getByRole('link', { name: FOOTER_LABEL }).first()).toBeVisible();
    });
  });
}
