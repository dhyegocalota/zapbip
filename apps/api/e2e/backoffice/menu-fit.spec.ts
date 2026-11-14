import { expectEveryOptionReachedInsideMenu, expectOpenMenuInsideScreen, MENU_FIT_VIEWPORTS } from '../landing/support/menu-fit';
import { test } from './fixtures';

const SIGN_IN_PATH = '/sign-in';
const FOOTER = '.shell-footer';
const BROWSER_LOCALES = ['pt-BR', 'ar'];
const SCROLL_PADDING_CLEARANCE_HEIGHT = 300;
const VIEWPORTS = MENU_FIT_VIEWPORTS.filter((viewport) => viewport.height >= SCROLL_PADDING_CLEARANCE_HEIGHT);

for (const viewport of VIEWPORTS) {
  for (const browserLocale of BROWSER_LOCALES) {
    test.describe(`${viewport.name} ${viewport.width}x${viewport.height} in ${browserLocale}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height }, locale: browserLocale });

      test(`the open menu sits inside the screen in ${viewport.columns} column(s)`, async ({ page }) => {
        await expectOpenMenuInsideScreen({ page, path: SIGN_IN_PATH, footer: FOOTER, viewport });
      });

      test('every option is reached in order inside the menu', async ({ page }) => {
        await expectEveryOptionReachedInsideMenu({ page, path: SIGN_IN_PATH, footer: FOOTER, viewport });
      });
    });
  }
}
