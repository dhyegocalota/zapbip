import { CLIENT_APP_LOGIN_TEXT, OwnerLocale, PRICING_FREE_MESSAGES } from '@zapbip/types';
import { ClientAppCopyKey, renderClientAppCopy } from '../../src/client-app/client-app-copy';
import { expect, test } from './fixtures';
import { setAccountState } from './support/client-app-database';
import { newOwnerPhone, requestSignInLink, type OwnerPhoneKind } from './support/owner-simulator';
import { capture } from './support/screenshots';

const AGENT_NAME = 'claude';
const INSTALL_PATH_PATTERN = /\/i\/zb_inst_/;
const WAITLISTED_STATE = 'waitlisted';
const FITS_VIEWPORT_SCRIPT = 'document.documentElement.scrollWidth <= window.innerWidth';
const BODY_BACKGROUND_SCRIPT = 'getComputedStyle(document.body).backgroundColor';
const DARK_PAGE_BACKGROUND = 'rgb(7, 18, 15)';
const LOCALES: { locale: OwnerLocale; home: string; phoneKind: OwnerPhoneKind; name: string }[] = [
  { locale: OwnerLocale.EnglishUs, home: '/', phoneKind: 'united_states', name: 'en' },
  { locale: OwnerLocale.PortugueseBrazil, home: '/pt-br', phoneKind: 'brazil', name: 'pt' },
];

function copy(input: { key: ClientAppCopyKey; locale: OwnerLocale; values?: Record<string, string> }): string {
  return renderClientAppCopy(input);
}

for (const { locale, home, phoneKind, name } of LOCALES) {
  test.describe(`customer web app in ${locale}`, () => {
    test('the signed-out page opens WhatsApp with the login word and never overflows', async ({ page }, testInfo) => {
      await page.goto(home);
      const button = page.getByRole('link', { name: copy({ key: ClientAppCopyKey.SignInWithWhatsapp, locale }) });
      await expect(button).toHaveAttribute('href', new RegExp(`^https://wa\\.me/\\d+\\?text=${CLIENT_APP_LOGIN_TEXT[locale]}$`));
      expect(await page.evaluate(FITS_VIEWPORT_SCRIPT)).toBe(true);
      await capture({ page, name: `${testInfo.project.name}-${name}-signed-out` });
    });

    test('sign in with the login link, connect an agent, revoke it and sign out', async ({ page }, testInfo) => {
      const prefix = `${testInfo.project.name}-${name}`;
      const phone = newOwnerPhone({ kind: phoneKind });
      const link = await requestSignInLink({ phone, word: CLIENT_APP_LOGIN_TEXT[locale] });
      await page.goto(link);
      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.ContinueButton, locale }) }).click();
      await expect(page).toHaveURL(new RegExp(`${home === '/' ? '/$' : home + '$'}`));
      await expect(page.getByRole('heading', { name: copy({ key: ClientAppCopyKey.AgentsTitle, locale }) })).toBeVisible();
      await expect(
        page.getByText(copy({ key: ClientAppCopyKey.PlanLine, locale, values: { free: String(PRICING_FREE_MESSAGES) } })),
      ).toBeVisible();
      await capture({ page, name: `${prefix}-agents-empty` });

      await page.getByLabel(copy({ key: ClientAppCopyKey.ConnectLabel, locale })).fill(AGENT_NAME);
      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.ConnectButton, locale }) }).click();
      await expect(page.locator('.prompt')).toContainText(INSTALL_PATH_PATTERN);
      expect(await page.evaluate(FITS_VIEWPORT_SCRIPT)).toBe(true);
      await capture({ page, name: `${prefix}-install-link` });
      await page.goto(home);
      await expect(page.locator('.agent-name')).toHaveText(AGENT_NAME);
      await expect(page.locator('.prompt')).toHaveCount(0);
      await capture({ page, name: `${prefix}-agents-list` });

      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.Revoke, locale }) }).click();
      await expect(
        page.getByRole('heading', { name: copy({ key: ClientAppCopyKey.RevokeTitle, locale, values: { agent: AGENT_NAME } }) }),
      ).toBeVisible();
      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.RevokeConfirm, locale }) }).click();
      await expect(page.getByText(copy({ key: ClientAppCopyKey.NoticeRevoked, locale }))).toBeVisible();
      await expect(page.locator('.agent-name')).toHaveCount(0);

      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.SignOut, locale }) }).click();
      await expect(page.getByRole('link', { name: copy({ key: ClientAppCopyKey.SignInWithWhatsapp, locale }) })).toBeVisible();
      expect(await page.evaluate(FITS_VIEWPORT_SCRIPT)).toBe(true);
    });

    test('a link that was used shows the expired page', async ({ page }, testInfo) => {
      const phone = newOwnerPhone({ kind: phoneKind });
      const link = await requestSignInLink({ phone, word: CLIENT_APP_LOGIN_TEXT[locale] });
      await page.goto(link);
      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.ContinueButton, locale }) }).click();
      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.SignOut, locale }) }).click();
      await page.goto(link);
      await expect(page.getByText(copy({ key: ClientAppCopyKey.ExpiredBody, locale }))).toBeVisible();
      await capture({ page, name: `${testInfo.project.name}-${name}-expired` });
    });

    test('a waitlisted account sees the waitlist and nothing else', async ({ page }, testInfo) => {
      const phone = newOwnerPhone({ kind: phoneKind });
      const link = await requestSignInLink({ phone, word: CLIENT_APP_LOGIN_TEXT[locale] });
      await page.goto(link);
      await page.getByRole('button', { name: copy({ key: ClientAppCopyKey.ContinueButton, locale }) }).click();
      setAccountState({ phone, state: WAITLISTED_STATE });
      await page.goto(home);
      await expect(page.getByRole('heading', { name: copy({ key: ClientAppCopyKey.WaitlistTitle, locale }) })).toBeVisible();
      await expect(page.getByLabel(copy({ key: ClientAppCopyKey.ConnectLabel, locale }))).toHaveCount(0);
      await capture({ page, name: `${testInfo.project.name}-${name}-waitlisted` });
    });

    test('follows the system colour scheme', async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(home);
      const background = await page.evaluate(BODY_BACKGROUND_SCRIPT);
      expect(background).toBe(DARK_PAGE_BACKGROUND);
      await capture({ page, name: `${testInfo.project.name}-${name}-signed-out-dark` });
    });
  });
}
