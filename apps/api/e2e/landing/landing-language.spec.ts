import type { Page } from '@playwright/test';
import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { OwnerLocale } from '@zapbip/types';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';
import { ShellCopyKey } from '../../src/web-shell/shell-copy';
import { expect, test } from './fixtures';
import { shellCopy } from './support/site-copy';

const PICKED_AGENT = Object.keys(AGENT_INSTALLS)[0]!;

const REFERRAL_CODE = 'abcdefgh2345';
const MOBILE_WIDTH = 375;

function menuOf(input: { page: Page }) {
  return input.page.locator('.lang-menu');
}

function triggerOf(input: { page: Page }) {
  return input.page.locator('.lang-trigger');
}

function optionOf(input: { page: Page; locale: OwnerLocale }) {
  return input.page.locator(`.lang-option[value="${input.locale}"]`);
}

test('the menu opens on a click, shows both languages and closes on Escape with the focus back on the button', async ({ page }) => {
  await page.goto('/');
  await expect(menuOf({ page })).not.toHaveAttribute('open', '');
  await triggerOf({ page }).scrollIntoViewIfNeeded();
  await triggerOf({ page }).click();
  await expect(menuOf({ page })).toHaveAttribute('open', '');
  await expect(optionOf({ page, locale: OwnerLocale.EnglishUs })).toBeVisible();
  await expect(optionOf({ page, locale: OwnerLocale.PortugueseBrazil })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menuOf({ page })).not.toHaveAttribute('open', '');
  await expect(triggerOf({ page })).toBeFocused();
});

test('a click outside closes it', async ({ page }) => {
  await page.goto('/');
  await triggerOf({ page }).click();
  await page.locator('.footer-legal').click();
  await expect(menuOf({ page })).not.toHaveAttribute('open', '');
});

test('the arrow keys move between the options', async ({ page }) => {
  await page.goto('/');
  await triggerOf({ page }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(optionOf({ page, locale: OwnerLocale.EnglishUs })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(optionOf({ page, locale: OwnerLocale.PortugueseBrazil })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(optionOf({ page, locale: OwnerLocale.EnglishUs })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(optionOf({ page, locale: OwnerLocale.PortugueseBrazil })).toBeFocused();
});

test('choosing Portuguese lands on /pt-br and keeps the agent and the referral code', async ({ page }) => {
  await page.goto(`/?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}`);
  await triggerOf({ page }).click();
  await optionOf({ page, locale: OwnerLocale.PortugueseBrazil }).click();
  await expect(page).toHaveURL(new RegExp(`/pt-br\\?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}$`));
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('input[name="referralCode"]')).toHaveValue(REFERRAL_CODE);
  await expect(page.locator('.join-agent')).toBeVisible();
  await expect(triggerOf({ page })).toContainText('PT');
});

test('the chosen language is remembered: the root then goes to /pt-br', async ({ page }) => {
  await page.goto('/');
  await triggerOf({ page }).click();
  await optionOf({ page, locale: OwnerLocale.PortugueseBrazil }).click();
  await page.goto('/');
  await expect(page).toHaveURL(/\/pt-br$/);
  await triggerOf({ page }).click();
  await optionOf({ page, locale: OwnerLocale.EnglishUs }).click();
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('a legacy address lands on the path', async ({ page }) => {
  await page.goto(`/?lang=pt_BR&ref=${REFERRAL_CODE}`);
  await expect(page).toHaveURL(new RegExp(`/pt-br\\?ref=${REFERRAL_CODE}$`));
});

test('the menu works with no script: the summary opens it and a choice reloads the page', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await triggerOf({ page }).click();
  await optionOf({ page, locale: OwnerLocale.PortugueseBrazil }).click();
  await expect(page).toHaveURL(/\/pt-br$/);
  await context.close();
});

test('the trigger names itself "Language" and "Idioma" with the visible code in its name', async ({ page }) => {
  await page.goto('/');
  await expect(triggerOf({ page })).toHaveAttribute(
    'aria-label',
    `${shellCopy({ key: ShellCopyKey.LocaleLabel })}: ${LOCALE_PROFILES[OwnerLocale.EnglishUs].shortName}`,
  );
  await page.goto('/pt-br');
  await expect(triggerOf({ page })).toHaveAttribute(
    'aria-label',
    `${shellCopy({ key: ShellCopyKey.LocaleLabel, locale: OwnerLocale.PortugueseBrazil })}: ${LOCALE_PROFILES[OwnerLocale.PortugueseBrazil].shortName}`,
  );
});

test.describe('375 px', () => {
  test.use({ viewport: { width: MOBILE_WIDTH, height: 812 } });

  test('the open menu fits inside the screen and the page does not scroll sideways', async ({ page }) => {
    await page.goto('/pt-br');
    await triggerOf({ page }).click();
    const list = (await page.locator('.lang-list').boundingBox())!;
    expect(list.x).toBeGreaterThanOrEqual(0);
    expect(list.x + list.width).toBeLessThanOrEqual(MOBILE_WIDTH);
    expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(MOBILE_WIDTH);
  });
});

test('an agent picked on the page survives a language switch', async ({ page }) => {
  const pickedTab = Object.keys(AGENT_INSTALLS)[1]!;
  await page.goto('/');
  await page.locator(`.start-tab[href*="agent=${pickedTab}"]`).click();
  await expect(page).toHaveURL(new RegExp(`agent=${pickedTab}`));
  await triggerOf({ page }).click();
  await optionOf({ page, locale: OwnerLocale.PortugueseBrazil }).click();
  await expect(page).toHaveURL(new RegExp(`/pt-br\\?agent=${pickedTab}`));
});

test('the language button shows one chevron, not the one the questions use', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(`getComputedStyle(document.querySelector('.lang-trigger'), '::before').content`)).toBe('none');
});
