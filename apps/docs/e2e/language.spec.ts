import { expect, test } from '@playwright/test';
import { DocsLanguage } from '@zapbip/types';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const PAGE_LANGUAGE_FOLDER = 'pt-br';
const OVERVIEW_PATH = '/';
const WHATSAPP_COMMANDS_PATH = '/features/whatsapp-commands';
const SWITCHER_LOCATOR = '#localization-select-trigger';
const SWITCHER_OPTION_LOCATOR = '[role="menuitem"]';
const LANGUAGE_NAMES: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'English',
  [DocsLanguage.PortugueseBrazil]: 'Português (BR)',
};
const OVERVIEW_FIRST_HEADING: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'Why zapbip exists',
  [DocsLanguage.PortugueseBrazil]: 'Por que o zapbip existe',
};
const ZERO_WIDTH_SPACE = /​/g;

function pathnameOf(input: { url: string }): string {
  return new URL(input.url).pathname;
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`language in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    test(`${DOCS_LOCALE_OF[language]} browser locale opens the English Overview and shows the switcher`, async ({ page }) => {
      await page.goto(OVERVIEW_PATH);
      const firstHeading = page.locator('#content-area h2').first();
      await expect(firstHeading).toBeVisible();
      const headingText = (await firstHeading.innerText()).replace(ZERO_WIDTH_SPACE, '').trim();
      expect(headingText).toBe(OVERVIEW_FIRST_HEADING[DocsLanguage.English]);
      expect(pathnameOf({ url: page.url() })).toBe(OVERVIEW_PATH);
      await expect(page.locator(SWITCHER_LOCATOR)).toBeVisible();
    });
  });
}

test.describe('the switcher', () => {
  test.use(docsOptionsOf({ language: DocsLanguage.English, viewport: DocsViewport.Desktop }));
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[DocsLanguage.English]);
  });

  test('lists both languages', async ({ page }) => {
    await page.goto(OVERVIEW_PATH);
    await page.locator(SWITCHER_LOCATOR).click();
    const optionNames = await page.locator(SWITCHER_OPTION_LOCATOR).allInnerTexts();
    expect(optionNames.map((name) => name.trim())).toEqual(Object.values(LANGUAGE_NAMES));
  });

  test('switching language keeps the page', async ({ page }) => {
    await page.goto(WHATSAPP_COMMANDS_PATH);
    await page.locator(SWITCHER_LOCATOR).click();
    await page.locator(SWITCHER_OPTION_LOCATOR).filter({ hasText: LANGUAGE_NAMES[DocsLanguage.PortugueseBrazil] }).click();
    await expect(page).toHaveURL(new RegExp(`/${PAGE_LANGUAGE_FOLDER}${WHATSAPP_COMMANDS_PATH}$`));
  });
});
