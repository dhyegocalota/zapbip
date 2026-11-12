import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { BACKOFFICE_LOCKOUT_THRESHOLD } from '../../src/contract/constants';
import { BACKOFFICE_TEST_EMAIL, BACKOFFICE_TEST_PASSWORD } from '../../test/support/backoffice-credentials';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { passwordFailedAttempts, wrongCode } from './support/operator-database';
import { fillCodeStep, fillPasswordStep, signIn } from './support/sign-in';

const SIGN_IN_PATH = /\/sign-in$/;
const CODE_PATH = /\/sign-in\/code$/;
const WRONG_PASSWORD = 'not the operator password';
const FAILED_SIGN_IN_PATH = /\/sign-in\?notice=SignInFailed$/;
const SIGNED_OUT_PATH = /\/sign-in\?notice=SignedOut$/;

test('signs in and out', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(SIGN_IN_PATH);
  await signIn({ page });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.SignOut }) }).click();
  await expect(page).toHaveURL(SIGNED_OUT_PATH);
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignedOutNotice }))).toBeVisible();
});

test('a right password asks for the code on its own page', async ({ page }) => {
  await page.goto('/sign-in');
  await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
  await expect(page).toHaveURL(CODE_PATH);
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInCodeLead }))).toBeVisible();
  await expect(page.getByLabel(copy({ key: BackofficeCopyKey.SignInPasswordLabel }))).toHaveCount(0);
});

test('a wrong password shows the generic failure and empties the password field', async ({ page }) => {
  await page.goto('/sign-in');
  await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  await expect(page).toHaveURL(FAILED_SIGN_IN_PATH);
  await expect(page.getByLabel(copy({ key: BackofficeCopyKey.SignInPasswordLabel }))).toHaveValue('');
});

test('a wrong code shows the generic failure and sends the browser back to the password page', async ({ page }) => {
  await page.goto('/sign-in');
  await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
  await fillCodeStep({ page, code: await wrongCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  await expect(page).toHaveURL(FAILED_SIGN_IN_PATH);
  await page.goto('/sign-in/code');
  await expect(page).toHaveURL(SIGN_IN_PATH);
});

test('the code page without a password step goes back to the password page', async ({ page }) => {
  await page.goto('/sign-in/code');
  await expect(page).toHaveURL(SIGN_IN_PATH);
});

test('reloading after a failed sign-in does not count another attempt', async ({ page }) => {
  await page.goto('/sign-in');
  await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD });
  await expect(page).toHaveURL(FAILED_SIGN_IN_PATH);
  expect(passwordFailedAttempts()).toBe(1);
  await page.reload();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  expect(passwordFailedAttempts()).toBe(1);
});

test('lockout refuses the correct factors after repeated failures', async ({ page, network }) => {
  await page.goto('/sign-in');
  await Array.from({ length: BACKOFFICE_LOCKOUT_THRESHOLD }).reduce<Promise<void>>(async (previous) => {
    await previous;
    network.rotateAddress();
    await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD });
    await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  }, Promise.resolve());
  network.rotateAddress();
  await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  await expect(page).toHaveURL(FAILED_SIGN_IN_PATH);
});
