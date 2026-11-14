import { OwnerLocale } from '@zapbip/types';
import { ClientAppPath, pathWithLocale } from '../../src/client-app/client-app-paths';
import { expectEveryOptionReachedInsideMenu, expectOpenMenuInsideScreen, MENU_FIT_VIEWPORTS } from '../landing/support/menu-fit';
import { test } from './fixtures';

const MENU_PATHS = [OwnerLocale.EnglishUs, OwnerLocale.Arabic].map((locale) => pathWithLocale({ locale, path: ClientAppPath.Home }));
const FOOTER = '.shell-footer';

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
