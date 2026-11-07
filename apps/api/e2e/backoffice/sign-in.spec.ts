import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { BACKOFFICE_LOCKOUT_THRESHOLD } from '../../src/contract/constants';
import { BACKOFFICE_TEST_KEY } from '../../test/support/backoffice-credentials';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { currentCode, failedAttempts, wrongCode } from './support/operator-database';
import { fillSignIn, signIn } from './support/sign-in';

const SIGN_IN_PATH = /\/sign-in$/;
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

test('wrong code shows the generic failure and empties the key field', async ({ page }) => {
  await page.goto('/sign-in');
  await fillSignIn({ page, key: BACKOFFICE_TEST_KEY, code: await wrongCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  await expect(page).toHaveURL(FAILED_SIGN_IN_PATH);
  await expect(page.getByLabel(copy({ key: BackofficeCopyKey.SignInKeyLabel }))).toHaveValue('');
});

test('reloading after a failed sign-in does not count another attempt', async ({ page }) => {
  await page.goto('/sign-in');
  await fillSignIn({ page, key: BACKOFFICE_TEST_KEY, code: await wrongCode() });
  await expect(page).toHaveURL(FAILED_SIGN_IN_PATH);
  expect(failedAttempts()).toBe(1);
  await page.reload();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  expect(failedAttempts()).toBe(1);
});

test('lockout refuses the correct factors after repeated failures', async ({ page, network }) => {
  await page.goto('/sign-in');
  const wrong = await wrongCode();
  await Array.from({ length: BACKOFFICE_LOCKOUT_THRESHOLD }).reduce<Promise<void>>(async (previous) => {
    await previous;
    network.rotateAddress();
    await fillSignIn({ page, key: BACKOFFICE_TEST_KEY, code: wrong });
    await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  }, Promise.resolve());
  network.rotateAddress();
  await fillSignIn({ page, key: BACKOFFICE_TEST_KEY, code: await currentCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.SignInFailed }))).toBeVisible();
  await expect(page).toHaveURL(FAILED_SIGN_IN_PATH);
});
