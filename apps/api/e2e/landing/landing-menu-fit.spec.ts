import type { Page } from '@playwright/test';
import { OwnerLocale } from '@zapbip/types';
import { localePathOf } from '../../src/site/site-language';
import { MENU_LOCALES } from '../../src/web-shell/locale-profiles';
import { expect, test } from './fixtures';

const VIEWPORTS = [
  { name: 'short phone', width: 375, height: 560, columns: 2 },
  { name: 'landscape phone', width: 740, height: 360, columns: 2 },
  { name: 'desktop', width: 1440, height: 900, columns: 1 },
];
const MENU_PATHS = [localePathOf({ locale: OwnerLocale.EnglishUs }), localePathOf({ locale: OwnerLocale.Arabic })];
const SCROLL_TO_END_SCRIPT = 'window.scrollTo(0, document.documentElement.scrollHeight)';
const PAGE_SCROLL_SCRIPT = 'window.scrollY';
const LIST_SELECTOR = '.site-footer .lang-list';
const ROW_TOLERANCE = 1;

type Box = { x: number; y: number; width: number; height: number };

function isInside(input: { inner: Box; outer: Box }): boolean {
  const { inner, outer } = input;
  const isInsideAcross = inner.x >= outer.x - ROW_TOLERANCE && inner.x + inner.width <= outer.x + outer.width + ROW_TOLERANCE;
  const isInsideDown = inner.y >= outer.y - ROW_TOLERANCE && inner.y + inner.height <= outer.y + outer.height + ROW_TOLERANCE;
  return isInsideAcross && isInsideDown;
}

async function openFooterMenu(input: { page: Page; path: string }): Promise<Box> {
  const { page, path } = input;
  await page.goto(path);
  await page.evaluate(SCROLL_TO_END_SCRIPT);
  await page.locator('.site-footer .lang-trigger').click();
  await expect(page.locator(LIST_SELECTOR)).toBeVisible();
  return (await page.locator(LIST_SELECTOR).boundingBox())!;
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    const screen: Box = { x: 0, y: 0, width: viewport.width, height: viewport.height };

    for (const path of MENU_PATHS) {
      test(`the open menu on ${path} sits inside the screen in ${viewport.columns} column(s)`, async ({ page }) => {
        const list = await openFooterMenu({ page, path });
        expect(isInside({ inner: list, outer: screen })).toBe(true);
        const firstRow = (await page.locator(`${LIST_SELECTOR} .lang-option`).first().boundingBox())!;
        const secondOption = (await page.locator(`${LIST_SELECTOR} .lang-option`).nth(1).boundingBox())!;
        const sharesFirstRow = Math.abs(firstRow.y - secondOption.y) <= ROW_TOLERANCE;
        expect(sharesFirstRow).toBe(viewport.columns === 2);
      });

      test(`every option on ${path} is reached in order inside the menu without moving the page`, async ({ page }) => {
        const list = await openFooterMenu({ page, path });
        const pageScroll = await page.evaluate(PAGE_SCROLL_SCRIPT);
        for (const locale of MENU_LOCALES) {
          await page.keyboard.press('Tab');
          const focused = page.locator(`${LIST_SELECTOR} .lang-option:focus`);
          await expect(focused).toHaveAttribute('value', locale);
          const option = (await focused.boundingBox())!;
          expect(isInside({ inner: option, outer: list })).toBe(true);
          expect(isInside({ inner: option, outer: screen })).toBe(true);
        }
        expect(await page.evaluate(PAGE_SCROLL_SCRIPT)).toBe(pageScroll);
      });
    }
  });
}
