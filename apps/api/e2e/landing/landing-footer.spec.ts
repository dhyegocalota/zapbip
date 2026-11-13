import type { Page } from '@playwright/test';
import { OwnerLocale } from '@zapbip/types';
import { expect, test } from './fixtures';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '375', width: 375, height: 812 },
];
const WORDMARK_MINIMUM_SHARE = 0.8;
const WORDMARK_WIDTH_SCRIPT =
  "(() => { const range = document.createRange(); range.selectNodeContents(document.querySelector('.footer-wordmark')); return range.getBoundingClientRect().width; })()";

function triggerOf(input: { page: Page }) {
  return input.page.locator('.site-footer .lang-trigger');
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('the footer menu opens upward, stays on screen and switches the language', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.site-header .lang-menu')).toHaveCount(0);
      await triggerOf({ page }).scrollIntoViewIfNeeded();
      await triggerOf({ page }).click();
      const trigger = (await triggerOf({ page }).boundingBox())!;
      const list = (await page.locator('.site-footer .lang-list').boundingBox())!;
      expect(list.y + list.height).toBeLessThanOrEqual(trigger.y);
      expect(list.x).toBeGreaterThanOrEqual(0);
      expect(list.x + list.width).toBeLessThanOrEqual(viewport.width);
      await page.locator(`.site-footer .lang-option[value="${OwnerLocale.PortugueseBrazil}"]`).click();
      await expect(page).toHaveURL(/\/pt-br$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
      expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(viewport.width);
    });

    test('the wordmark spans the container and never overflows', async ({ page }) => {
      await page.goto('/');
      const container = (await page.locator('.site-footer .container').boundingBox())!;
      const wordmark = (await page.evaluate(WORDMARK_WIDTH_SCRIPT)) as number;
      expect(wordmark).toBeGreaterThanOrEqual(container.width * WORDMARK_MINIMUM_SHARE);
      expect(wordmark).toBeLessThanOrEqual(container.width);
    });
  });
}

test('the footer keeps its content under reduced motion and in the dark theme', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/pt-br');
  await expect(page.locator('.footer-wordmark')).toBeVisible();
  await expect(page.locator('.site-footer a[href="https://logicbit.com.br"]')).toHaveAttribute('rel', 'noopener');
});
