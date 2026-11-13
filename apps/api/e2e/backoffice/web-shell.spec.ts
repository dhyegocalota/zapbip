import { WebLocale } from '@zapbip/types';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';
import { ShellCopyKey, renderShellCopy } from '../../src/web-shell/shell-copy';
import { ShellTheme } from '../../src/web-shell/shell-theme';
import { expect, test } from './fixtures';
import { capture } from './support/screenshots';
import { signIn } from './support/sign-in';

const DARK_PAGE_BACKGROUND = 'rgb(7, 18, 15)';
const BODY_BACKGROUND_SCRIPT = 'getComputedStyle(document.body).backgroundColor';
const FITS_VIEWPORT_SCRIPT = 'document.documentElement.scrollWidth <= window.innerWidth';
const BROWSER_LOCALE = WebLocale.PortugueseBrazil;
const OTHER_LOCALE = WebLocale.EnglishUs;

test('the sign-in page has the shared footer, and its menu switches the language upward', async ({ page }, testInfo) => {
  await page.goto('/sign-in');
  const footer = page.getByRole('contentinfo');
  await expect(
    footer.getByRole('link', { name: renderShellCopy({ key: ShellCopyKey.FooterTerms, locale: BROWSER_LOCALE }) }),
  ).toBeVisible();
  await footer.locator('summary').click();
  await capture({ page, name: `${testInfo.project.name}-sign-in-footer-menu-open` });
  const list = footer.locator('.lang-list');
  const triggerBox = (await footer.locator('summary').boundingBox())!;
  const listBox = (await list.boundingBox())!;
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(triggerBox.y);

  await list.getByRole('button', { name: LOCALE_PROFILES[OTHER_LOCALE].nativeName }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', LOCALE_PROFILES[OTHER_LOCALE].languageTag);
  await expect(page.getByRole('contentinfo').locator('summary')).toHaveAttribute('aria-label', /: EN$/);
  expect(await page.evaluate(FITS_VIEWPORT_SCRIPT)).toBe(true);
});

test('the footer theme switch persists the dark theme', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/sign-in');
  await page
    .getByRole('contentinfo')
    .getByRole('button', { name: renderShellCopy({ key: ShellCopyKey.ThemeDark, locale: BROWSER_LOCALE }) })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', ShellTheme.Dark);
  expect(await page.evaluate(BODY_BACKGROUND_SCRIPT)).toBe(DARK_PAGE_BACKGROUND);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', ShellTheme.Dark);
  await capture({ page, name: `${testInfo.project.name}-sign-in-dark` });
});

test('signed in, the header keeps the navigation and sign out while the footer holds the switches', async ({ page }, testInfo) => {
  await signIn({ page });
  await expect(page.getByRole('banner').locator('.lang-menu, .switch')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('contentinfo').locator('.lang-menu')).toHaveCount(1);
  await expect(page.getByRole('contentinfo').locator('.switch')).toHaveCount(1);
  expect(await page.evaluate(FITS_VIEWPORT_SCRIPT)).toBe(true);
  await capture({ page, name: `${testInfo.project.name}-home-header-footer` });
});
