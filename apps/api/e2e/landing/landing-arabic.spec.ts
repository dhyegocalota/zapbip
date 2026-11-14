import { OwnerLocale } from '@zapbip/types';
import { localePathOf } from '../../src/site/site-language';
import { expect, test } from './fixtures';

const ARABIC_PATH = localePathOf({ locale: OwnerLocale.Arabic });
const PHONE_WIDTH = 360;
const NO_SIDEWAYS_SCROLL_SCRIPT = 'document.documentElement.scrollWidth <= document.documentElement.clientWidth';
const CODE_DIRECTION_SCRIPT = "getComputedStyle(document.querySelector('pre')).direction";
const HEADING_SPACING_SCRIPT = "getComputedStyle(document.querySelector('h1')).letterSpacing";
const FIRST_COLUMN_SCRIPT = "document.querySelector('.site-header .brand').getBoundingClientRect().right";
const VIEWPORT_WIDTH_SCRIPT = 'document.documentElement.clientWidth';
const MENU_TRIGGER_LEFT_SCRIPT = "document.querySelector('.lang-trigger').getBoundingClientRect().left";
const BRAND_LEFT_SCRIPT = "document.querySelector('.site-header .brand').getBoundingClientRect().left";

for (const width of [PHONE_WIDTH, undefined]) {
  test.describe(width === undefined ? 'desktop' : `${width} px`, () => {
    if (width !== undefined) test.use({ viewport: { width, height: 800 } });

    test('the page reads right to left and never scrolls sideways', async ({ page }) => {
      await page.goto(ARABIC_PATH);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      expect(await page.evaluate(NO_SIDEWAYS_SCROLL_SCRIPT)).toBe(true);
    });

    test('the brand sits at the right edge and the language menu at the left', async ({ page }) => {
      await page.goto(ARABIC_PATH);
      const viewportWidth = (await page.evaluate(VIEWPORT_WIDTH_SCRIPT)) as number;
      const brandRight = (await page.evaluate(FIRST_COLUMN_SCRIPT)) as number;
      expect(brandRight).toBeGreaterThan(viewportWidth / 2);
      expect((await page.evaluate(BRAND_LEFT_SCRIPT)) as number).toBeGreaterThan(
        ((await page.evaluate(MENU_TRIGGER_LEFT_SCRIPT)) as number) - 1,
      );
    });

    test('the quick-start code stays left to right inside the right-to-left page', async ({ page }) => {
      await page.goto(ARABIC_PATH);
      const direction = await page.evaluate(CODE_DIRECTION_SCRIPT);
      expect(direction).toBe('ltr');
    });

    test('Arabic text uses no letter spacing', async ({ page }) => {
      await page.goto(ARABIC_PATH);
      const spacing = await page.evaluate(HEADING_SPACING_SCRIPT);
      expect(['normal', '0px']).toContain(spacing);
    });
  });
}
