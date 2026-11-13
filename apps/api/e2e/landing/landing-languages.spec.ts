import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { WebLocale } from '@zapbip/types';
import { localePathOf } from '../../src/site/site-language';
import { SiteCopyKey } from '../../src/site/site-copy';
import { LOCALE_PROFILES, MENU_LOCALES } from '../../src/web-shell/locale-profiles';
import { expect, test } from './fixtures';
import { siteCopy } from './support/site-copy';

const SCREENSHOT_DIRECTORY_VARIABLE = 'ZAPBIP_LANGUAGES_SCREENSHOT_DIRECTORY';
const MOBILE_WIDTH = 375;
const LANGUAGE_COUNT = 8;
const SHOT_LOCALES = [WebLocale.Japanese, WebLocale.ChineseSimplified, WebLocale.Korean, WebLocale.German];
const NO_SIDEWAYS_SCROLL_SCRIPT = 'document.documentElement.scrollWidth <= document.documentElement.clientWidth';
const HERO_TITLE_SELECTOR = 'h1';

async function openMenu(input: { page: Page }): Promise<void> {
  await input.page.locator('.lang-trigger').scrollIntoViewIfNeeded();
  await input.page.locator('.lang-trigger').click();
}

test('the menu lists the eight languages with their native names', async ({ page }) => {
  await page.goto('/');
  await openMenu({ page });
  const options = page.locator('.lang-option');
  await expect(options).toHaveCount(LANGUAGE_COUNT);
  await expect(options).toHaveText(MENU_LOCALES.map((locale) => LOCALE_PROFILES[locale].nativeName));
});

for (const locale of MENU_LOCALES.filter((candidate) => candidate !== WebLocale.EnglishUs)) {
  test(`choosing ${locale} lands on its path, in its language, with no sideways scroll`, async ({ page }) => {
    const profile = LOCALE_PROFILES[locale];
    await page.goto('/');
    await openMenu({ page });
    await page.locator(`.lang-option[value="${locale}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${localePathOf({ locale })}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', profile.languageTag);
    await expect(page.locator(HERO_TITLE_SELECTOR)).toContainText(siteCopy({ key: SiteCopyKey.HeroTitleAccent, locale }));
    await expect(page.locator('.lang-trigger')).toContainText(profile.shortName);
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL_SCRIPT)).toBe(true);
  });
}

test('the chosen language is remembered: the root then goes to its path', async ({ page }) => {
  await page.goto('/');
  await openMenu({ page });
  await page.locator(`.lang-option[value="${WebLocale.Japanese}"]`).click();
  await page.goto('/');
  await expect(page).toHaveURL(/\/ja$/);
});

test.describe('375 px', () => {
  test.use({ viewport: { width: MOBILE_WIDTH, height: 812 } });

  test('the open menu of eight options fits the screen', async ({ page }) => {
    await page.goto('/ko');
    await openMenu({ page });
    const list = (await page.locator('.lang-list').boundingBox())!;
    expect(list.x).toBeGreaterThanOrEqual(0);
    expect(list.x + list.width).toBeLessThanOrEqual(MOBILE_WIDTH);
    expect(list.y).toBeGreaterThanOrEqual(0);
  });

  for (const locale of SHOT_LOCALES) {
    test(`the ${locale} hero fits 375 px and is photographed`, async ({ page }, testInfo) => {
      await page.goto(localePathOf({ locale }));
      expect(await page.evaluate(NO_SIDEWAYS_SCROLL_SCRIPT)).toBe(true);
      await expect(page.locator(HERO_TITLE_SELECTOR)).toBeVisible();
      const directory = process.env[SCREENSHOT_DIRECTORY_VARIABLE];
      if (directory === undefined) return;
      mkdirSync(directory, { recursive: true });
      await page.screenshot({ path: join(directory, `${testInfo.project.name}-${locale}-hero.png`) });
    });
  }
});
