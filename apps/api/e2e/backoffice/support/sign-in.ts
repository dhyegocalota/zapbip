import { expect, type Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../../src/backoffice/backoffice-copy';
import { BACKOFFICE_TEST_KEY } from '../../../test/support/backoffice-credentials';
import { copy } from './copy';
import { freshCode } from './operator-database';

export async function fillSignIn(input: { page: Page; key: string; code: string }): Promise<void> {
  const { page } = input;
  await page.getByLabel(copy({ key: BackofficeCopyKey.SignInKeyLabel })).fill(input.key);
  await page.getByLabel(copy({ key: BackofficeCopyKey.SignInCodeLabel })).fill(input.code);
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.SignInSubmit }) }).click();
}

export async function signIn(input: { page: Page }): Promise<void> {
  const { page } = input;
  await page.goto('/');
  await fillSignIn({ page, key: BACKOFFICE_TEST_KEY, code: await freshCode() });
  await expect(page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.HomeTitle }) })).toBeVisible();
}
