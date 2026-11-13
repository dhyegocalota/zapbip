import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const NO_CONTENT_STATUS = 204;
const LIGHT_PAGE_BACKGROUND = 'rgb(246, 248, 245)';
const DARK_PAGE_BACKGROUND = 'rgb(7, 18, 15)';
const LIGHT_BAND_BACKGROUND = 'rgb(238, 243, 239)';
const LIGHT_CARD_BACKGROUND = 'rgb(255, 255, 255)';
const DARK_CARD_BACKGROUND = 'rgb(13, 27, 23)';
const TERMINAL_BACKGROUND = 'rgb(13, 27, 23)';
const LANGUAGE_PATHS = ['/', '/pt-br'];

function themeButtonOf(input: { page: Page; theme: string }) {
  return input.page.locator(`.site-footer button[name="theme"][value="${input.theme}"]`);
}

async function backgroundOf(input: { page: Page; selector: string }): Promise<string> {
  return (await input.page.evaluate(`getComputedStyle(document.querySelector('${input.selector}')).backgroundColor`)) as string;
}

for (const path of LANGUAGE_PATHS) {
  test.describe(`a dark system on ${path}`, () => {
    test.use({ colorScheme: 'dark' });

    test('choosing Light turns the whole page light at once, where the reader is, and keeps it after a reload', async ({ page }) => {
      await page.goto(path);
      const light = themeButtonOf({ page, theme: 'light' });
      await light.scrollIntoViewIfNeeded();
      const address = page.url();
      const scrolled = await page.evaluate('window.scrollY');
      const saved = page.waitForResponse((response) => response.url().endsWith('/theme'));
      await light.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect((await saved).status()).toBe(NO_CONTENT_STATUS);
      await expect(light).toHaveAttribute('aria-pressed', 'true');
      expect(page.url()).toBe(address);
      expect(await page.evaluate('window.scrollY')).toBe(scrolled);
      expect(await backgroundOf({ page, selector: 'body' })).toBe(LIGHT_PAGE_BACKGROUND);
      expect(await backgroundOf({ page, selector: '#privacy' })).toContain(LIGHT_BAND_BACKGROUND);
      expect(await backgroundOf({ page, selector: '.why-visual .scene' })).toBe(LIGHT_CARD_BACKGROUND);
      expect(await backgroundOf({ page, selector: '.plan-pro' })).toBe(LIGHT_CARD_BACKGROUND);
      expect(await backgroundOf({ page, selector: '.start-panel:not([hidden]) .code-window' })).toBe(TERMINAL_BACKGROUND);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await backgroundOf({ page, selector: 'body' })).toBe(LIGHT_PAGE_BACKGROUND);
    });
  });

  test.describe(`a light system on ${path}`, () => {
    test.use({ colorScheme: 'light' });

    test('choosing Dark turns the page dark at once and System follows the light system again', async ({ page }) => {
      await page.goto(path);
      await themeButtonOf({ page, theme: 'dark' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(await backgroundOf({ page, selector: 'body' })).toBe(DARK_PAGE_BACKGROUND);
      expect(await backgroundOf({ page, selector: '.plan-pro' })).toBe(DARK_CARD_BACKGROUND);
      await themeButtonOf({ page, theme: 'system' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
      expect(await backgroundOf({ page, selector: 'body' })).toBe(LIGHT_PAGE_BACKGROUND);
      expect(await backgroundOf({ page, selector: '#privacy' })).toContain(LIGHT_BAND_BACKGROUND);
    });
  });
}

test.describe('without a script', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'dark' });

  test('choosing Light comes back to the theme switch, light', async ({ page }) => {
    await page.goto('/');
    await themeButtonOf({ page, theme: 'light' }).click();
    await expect(page).toHaveURL(/#theme$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
