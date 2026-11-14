import { expect, test, type Page } from '@playwright/test';
import { DocsPageLanguage } from '@zapbip/types';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';
import { twinPathOf } from '../../../libs/agents/src/docs';

const OVERVIEW_PATH = '/';
const WHATSAPP_COMMANDS_PATH = '/features/whatsapp-commands';
const SWITCHER_LOCATOR = '#localization-select-trigger';
const SWITCHER_OPTION_LOCATOR = '[role="menuitem"]';
const PAGE_TITLE_LOCATOR = 'h1';
const WHATSAPP_COMMANDS_TITLE: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'Commands on WhatsApp',
  [DocsPageLanguage.PortugueseBrazil]: 'Comandos no WhatsApp',
  [DocsPageLanguage.Spanish]: 'Comandos en WhatsApp',
  [DocsPageLanguage.German]: 'Befehle in WhatsApp',
  [DocsPageLanguage.French]: 'Commandes sur WhatsApp',
  [DocsPageLanguage.Japanese]: 'WhatsApp のコマンド',
  [DocsPageLanguage.Korean]: 'WhatsApp 명령어',
  [DocsPageLanguage.Chinese]: 'WhatsApp 命令',
};
const REACT_PROPS_KEY_PREFIX = '__reactProps$';
const LANGUAGE_NAMES: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'English',
  [DocsPageLanguage.PortugueseBrazil]: 'Português (BR)',
  [DocsPageLanguage.Spanish]: 'Español',
  [DocsPageLanguage.German]: 'Deutsch',
  [DocsPageLanguage.French]: 'Français',
  [DocsPageLanguage.Japanese]: '日本語',
  [DocsPageLanguage.Korean]: '한국어',
  [DocsPageLanguage.Chinese]: '简体中文',
};
const OVERVIEW_FIRST_HEADING: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'Why zapbip exists',
  [DocsPageLanguage.PortugueseBrazil]: 'Por que o zapbip existe',
  [DocsPageLanguage.Spanish]: 'Por qué existe zapbip',
  [DocsPageLanguage.German]: 'Warum es zapbip gibt',
  [DocsPageLanguage.French]: 'Pourquoi zapbip existe',
  [DocsPageLanguage.Japanese]: 'zapbip が生まれた理由',
  [DocsPageLanguage.Korean]: 'zapbip가 존재하는 이유',
  [DocsPageLanguage.Chinese]: '为什么有 zapbip',
};
const ZERO_WIDTH_SPACE = /​/g;

async function waitForSwitcherHydration(input: { page: Page }): Promise<void> {
  await input.page.waitForFunction(
    ({ selector, keyPrefix }) => {
      const switcher = document.querySelector(selector);
      return switcher !== null && Object.keys(switcher).some((key) => key.startsWith(keyPrefix));
    },
    { selector: SWITCHER_LOCATOR, keyPrefix: REACT_PROPS_KEY_PREFIX },
  );
}

function pathnameOf(input: { url: string }): string {
  return new URL(input.url).pathname;
}

for (const language of Object.values(DocsPageLanguage)) {
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
      expect(headingText).toBe(OVERVIEW_FIRST_HEADING[DocsPageLanguage.English]);
      expect(pathnameOf({ url: page.url() })).toBe(OVERVIEW_PATH);
      await expect(page.locator(SWITCHER_LOCATOR)).toBeVisible();
    });
  });
}

test.describe('the switcher', () => {
  test.use(docsOptionsOf({ language: DocsPageLanguage.English, viewport: DocsViewport.Desktop }));
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[DocsPageLanguage.English]);
  });

  test('lists every language', async ({ page }) => {
    await page.goto(OVERVIEW_PATH);
    await waitForSwitcherHydration({ page });
    await page.locator(SWITCHER_LOCATOR).click();
    await expect(page.locator(SWITCHER_OPTION_LOCATOR)).toHaveText(Object.values(LANGUAGE_NAMES));
  });

  for (const language of Object.values(DocsPageLanguage).filter((candidate) => candidate !== DocsPageLanguage.English)) {
    test(`switching to ${language} keeps the page`, async ({ page }) => {
      await page.goto(WHATSAPP_COMMANDS_PATH);
      await expect(page.locator(PAGE_TITLE_LOCATOR)).toHaveText(WHATSAPP_COMMANDS_TITLE[DocsPageLanguage.English]);
      await waitForSwitcherHydration({ page });
      await page.locator(SWITCHER_LOCATOR).click();
      await page.locator(SWITCHER_OPTION_LOCATOR).filter({ hasText: LANGUAGE_NAMES[language] }).click();
      await expect(page).toHaveURL(new RegExp(`/${twinPathOf({ path: WHATSAPP_COMMANDS_PATH.slice(1), language })}$`));
      await expect(page.locator(PAGE_TITLE_LOCATOR)).toHaveText(WHATSAPP_COMMANDS_TITLE[language]);
    });
  }
});
