import { CLIENT_APP_LOGIN_TEXT, OwnerLocale } from '@zapbip/types';
import { ClientAppCopyKey, renderClientAppCopy } from '../../src/client-app/client-app-copy';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';
import { ShellCopyKey, renderShellCopy } from '../../src/web-shell/shell-copy';
import { ShellTheme } from '../../src/web-shell/shell-theme';
import { expect, test } from './fixtures';
import { capture } from './support/screenshots';

const FITS_VIEWPORT_SCRIPT = 'document.documentElement.scrollWidth <= window.innerWidth';
const BODY_BACKGROUND_SCRIPT = 'getComputedStyle(document.body).backgroundColor';
const DARK_PAGE_BACKGROUND = 'rgb(7, 18, 15)';
const LIGHT_PAGE_BACKGROUND = 'rgb(246, 248, 245)';
const FULLY_OPAQUE = '1';
const COLOR_SCHEMES = ['light', 'dark'] as const;
const PAGES: { locale: OwnerLocale; home: string; other: OwnerLocale; otherHome: string; name: string }[] = [
  { locale: OwnerLocale.EnglishUs, home: '/', other: OwnerLocale.PortugueseBrazil, otherHome: '/pt-br', name: 'en' },
  { locale: OwnerLocale.PortugueseBrazil, home: '/pt-br', other: OwnerLocale.EnglishUs, otherHome: '/', name: 'pt' },
  { locale: OwnerLocale.Japanese, home: '/ja', other: OwnerLocale.EnglishUs, otherHome: '/', name: 'ja' },
  { locale: OwnerLocale.ChineseSimplified, home: '/zh', other: OwnerLocale.EnglishUs, otherHome: '/', name: 'zh' },
  { locale: OwnerLocale.Korean, home: '/ko', other: OwnerLocale.EnglishUs, otherHome: '/', name: 'ko' },
  { locale: OwnerLocale.German, home: '/de', other: OwnerLocale.EnglishUs, otherHome: '/', name: 'de' },
];

for (const { locale, home, other, otherHome, name } of PAGES) {
  test.describe(`the shared shell on the app in ${locale}`, () => {
    for (const colorScheme of COLOR_SCHEMES) {
      test(`the hero fits the viewport and shows the exchange in the ${colorScheme} scheme`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(home);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          renderClientAppCopy({ key: ClientAppCopyKey.SignedOutTitle, locale }),
        );
        await expect(page.locator('figure.phone')).toBeVisible();
        await expect(page.locator('.bubble-outgoing')).toHaveText(new RegExp(CLIENT_APP_LOGIN_TEXT[locale]));
        await expect(page.locator('.bubble-incoming')).toHaveCSS('opacity', FULLY_OPAQUE);
        await expect(page.locator('.typing')).toBeHidden();
        expect(await page.evaluate(FITS_VIEWPORT_SCRIPT)).toBe(true);
        await capture({ page, name: `${testInfo.project.name}-${name}-hero-${colorScheme}` });
      });
    }

    test('reduced motion shows the finished chat at once', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(home);
      await expect(page.locator('.bubble-incoming')).toHaveCSS('opacity', FULLY_OPAQUE);
      await expect(page.locator('.bubble-outgoing')).toHaveCSS('opacity', FULLY_OPAQUE);
      await expect(page.locator('.typing')).toBeHidden();
    });

    test('the footer menu opens upward and changes the language', async ({ page }, testInfo) => {
      await page.goto(home);
      const footer = page.getByRole('contentinfo');
      const label = renderShellCopy({ key: ShellCopyKey.LocaleLabel, locale });
      await footer.locator('summary').click();
      const list = footer.locator('.lang-list');
      await expect(list).toBeVisible();
      const triggerBox = (await footer.locator('summary').boundingBox())!;
      const listBox = (await list.boundingBox())!;
      expect(listBox.y + listBox.height).toBeLessThanOrEqual(triggerBox.y);
      await expect(footer.locator('summary')).toHaveAttribute('aria-label', new RegExp(`^${label}: `));
      await capture({ page, name: `${testInfo.project.name}-${name}-footer-menu-open` });
      await list.getByRole('button', { name: LOCALE_PROFILES[other].nativeName }).click();
      await expect(page).toHaveURL(new RegExp(`${otherHome === '/' ? '/$' : `${otherHome}$`}`));
      await expect(page.locator('html')).toHaveAttribute('lang', LOCALE_PROFILES[other].languageTag);
    });

    test('the theme switch works with no script and survives a reload', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(home);
      const label = renderShellCopy({ key: ShellCopyKey.ThemeDark, locale });
      await page.getByRole('contentinfo').getByRole('button', { name: label }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', ShellTheme.Dark);
      expect(await page.evaluate(BODY_BACKGROUND_SCRIPT)).toBe(DARK_PAGE_BACKGROUND);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', ShellTheme.Dark);
      await page
        .getByRole('contentinfo')
        .getByRole('button', { name: renderShellCopy({ key: ShellCopyKey.ThemeLight, locale }) })
        .click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', ShellTheme.Light);
      expect(await page.evaluate(BODY_BACKGROUND_SCRIPT)).toBe(LIGHT_PAGE_BACKGROUND);
    });

    test('names its landmarks and links the docs, terms, privacy and Logic Bit', async ({ page }, testInfo) => {
      await page.goto(home);
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('main')).toBeVisible();
      const footer = page.getByRole('contentinfo');
      await Promise.all(
        [ShellCopyKey.FooterDocs, ShellCopyKey.FooterTerms, ShellCopyKey.FooterPrivacy, ShellCopyKey.FooterMadeBy].map((key) =>
          expect(footer.getByRole('link', { name: renderShellCopy({ key, locale }) })).toBeVisible(),
        ),
      );
      await capture({ page, name: `${testInfo.project.name}-${name}-footer` });
    });
  });
}
