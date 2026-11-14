import { OwnerLocale } from '@zapbip/types';
import { localePathOf } from '../../src/site/site-language';
import { test } from './fixtures';
import { expectEveryOptionReachedInsideMenu, expectOpenMenuInsideScreen, MENU_FIT_VIEWPORTS } from './support/menu-fit';

const MENU_PATHS = [localePathOf({ locale: OwnerLocale.EnglishUs }), localePathOf({ locale: OwnerLocale.Arabic })];
const FOOTER = '.site-footer';

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
