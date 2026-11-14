import { OwnerLocale } from '@zapbip/types';
import { localePathOf } from '../../src/site/site-language';
import { expect, test } from './fixtures';
import { expectEveryOptionReachedInsideMenu, expectOpenMenuInsideScreen, MENU_FIT_VIEWPORTS } from './support/menu-fit';

const MENU_PATHS = [localePathOf({ locale: OwnerLocale.EnglishUs }), localePathOf({ locale: OwnerLocale.Arabic })];
const FOOTER = '.site-footer';
const LEADING_MARK_SCRIPT = "getComputedStyle(document.querySelector('.site-footer .lang-trigger'), '::before').content";

for (const viewport of MENU_FIT_VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const path of MENU_PATHS) {
      test(`the open menu on ${path} sits inside the screen in ${viewport.columns} column(s)`, async ({ page }) => {
        await expectOpenMenuInsideScreen({ page, path, footer: FOOTER, viewport });
      });

      test(`every option on ${path} is reached in order inside the menu`, async ({ page }) => {
        await expectEveryOptionReachedInsideMenu({ page, path, footer: FOOTER, viewport });
      });
    }
  });
}

test('the Arabic menu trigger draws a single chevron', async ({ page }) => {
  await page.goto(localePathOf({ locale: OwnerLocale.Arabic }));
  expect(await page.evaluate(LEADING_MARK_SCRIPT)).toBe('none');
});
