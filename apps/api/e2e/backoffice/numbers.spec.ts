import type { Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { freshCode, wrongCode } from './support/operator-database';
import {
  activateNumber,
  changeState,
  credentialTextsOf,
  fillCode,
  registerNumber,
  registerNumberWithFreshCode,
  stateBadgeOf,
  verifyNumber,
  walkNumberOf,
} from './support/numbers';
import { signIn } from './support/sign-in';

const REGISTER_PATH = /\/numbers\/new$/;
const CREDENTIAL_SET_PREFIX = copy({ key: BackofficeCopyKey.CredentialSet, values: { date: '' } }).trim();
const MANY_NUMBER_COUNT = 3;

test.beforeEach(({ page }) => signIn({ page }));

async function expectNoHorizontalScroll(input: { page: Page }): Promise<void> {
  const viewport = input.page.viewportSize();
  if (viewport === null) throw new Error('the page has no viewport');
  const scrollWidth = await input.page.locator('html').evaluate((element) => element.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
}

test('lists no number before the first registration', async ({ page }) => {
  await page
    .getByRole('link', { name: copy({ key: BackofficeCopyKey.NavigationNumbers }), exact: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: copy({ key: BackofficeCopyKey.NumbersEmptyTitle }) })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('registers, verifies and activates a number', async ({ page, fakeGraph }) => {
  const number = walkNumberOf({ index: 1 });
  await registerNumberWithFreshCode({ page, number });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.NoticeRegistered }))).toBeVisible();
  await expect(stateBadgeOf({ page, key: BackofficeCopyKey.StatePending })).toBeVisible();
  await verifyNumber({ page, fakeGraph, number });
  await changeState({ page, optionKey: BackofficeCopyKey.NumberStateOptionActive, code: await freshCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.NoticeStateChanged }))).toBeVisible();
  await expect(stateBadgeOf({ page, key: BackofficeCopyKey.StateActive })).toBeVisible();
  const content = await page.content();
  credentialTextsOf({ number }).forEach((credential) => expect(content).not.toContain(credential));
  await page
    .getByRole('main')
    .getByRole('link', { name: copy({ key: BackofficeCopyKey.NumberBack }), exact: true })
    .click();
  await expect(page.getByRole('link', { name: number.label })).toBeVisible();
  await expect(page.getByText(number.displayNumber)).toBeVisible();
});

test('lists many numbers without horizontal scrolling', async ({ page }) => {
  const numbers = Array.from({ length: MANY_NUMBER_COUNT }, (_, index) => walkNumberOf({ index }));
  await numbers.reduce<Promise<void>>(async (previous, number) => {
    await previous;
    await registerNumberWithFreshCode({ page, number });
  }, Promise.resolve());
  await page.goto('/numbers');
  await Promise.all(numbers.map((number) => expect(page.getByRole('link', { name: number.label })).toBeVisible()));
  await expectNoHorizontalScroll({ page });
  await page.goto('/audit');
  await expect(page.getByRole('table')).toBeVisible();
  await expectNoHorizontalScroll({ page });
});

test('replaces the access token without showing it', async ({ page }) => {
  const number = walkNumberOf({ index: 1 });
  const replacement = 'walk-replacement-access-token';
  await registerNumberWithFreshCode({ page, number });
  await page.getByLabel(copy({ key: BackofficeCopyKey.NumberRotateTokenLabel }), { exact: true }).fill(replacement);
  await fillCode({ page, id: 'token-code', code: await freshCode() });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.NumberRotateTokenSubmit }) }).click();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.NoticeAccessTokenReplaced }))).toBeVisible();
  await expect(page.getByText(CREDENTIAL_SET_PREFIX).first()).toBeVisible();
  const content = await page.content();
  [replacement, ...credentialTextsOf({ number })].forEach((credential) => expect(content).not.toContain(credential));
});

test('replaces the app secret without showing it', async ({ page }) => {
  const number = walkNumberOf({ index: 1 });
  const replacement = 'walk-replacement-app-secret';
  await registerNumberWithFreshCode({ page, number });
  await page.getByLabel(copy({ key: BackofficeCopyKey.NumberRotateSecretLabel }), { exact: true }).fill(replacement);
  await fillCode({ page, id: 'secret-code', code: await freshCode() });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.NumberRotateSecretSubmit }) }).click();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.NoticeAppSecretReplaced }))).toBeVisible();
  const content = await page.content();
  [replacement, ...credentialTextsOf({ number })].forEach((credential) => expect(content).not.toContain(credential));
});

test('refuses a registration whose step-up code is wrong', async ({ page }) => {
  await registerNumber({ page, number: walkNumberOf({ index: 1 }), code: await wrongCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.StepUpRejected }))).toBeVisible();
  await expect(page).toHaveURL(REGISTER_PATH);
  await page.goto('/numbers');
  await expect(page.getByRole('heading', { name: copy({ key: BackofficeCopyKey.NumbersEmptyTitle }) })).toBeVisible();
});

test('refuses a state change whose step-up code is wrong', async ({ page, fakeGraph }) => {
  await activateNumber({ page, fakeGraph, number: walkNumberOf({ index: 1 }) });
  await changeState({ page, optionKey: BackofficeCopyKey.NumberStateOptionClosed, code: await wrongCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.StepUpRejected }))).toBeVisible();
  await expect(stateBadgeOf({ page, key: BackofficeCopyKey.StateActive })).toBeVisible();
});
