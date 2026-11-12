import { expect, type Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../../src/backoffice/backoffice-copy';
import { BACKOFFICE_TEST_EMAIL, BACKOFFICE_TEST_PASSWORD } from '../../../test/support/backoffice-credentials';
import { copy } from './copy';
import { freshCode } from './operator-database';

export async function fillPasswordStep(input: { page: Page; email: string; password: string }): Promise<void> {
  const { page } = input;
  await page.getByLabel(copy({ key: BackofficeCopyKey.SignInEmailLabel })).fill(input.email);
  await page.getByLabel(copy({ key: BackofficeCopyKey.SignInPasswordLabel })).fill(input.password);
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.SignInSubmit }) }).click();
}

export async function fillCodeStep(input: { page: Page; code: string }): Promise<void> {
  const { page } = input;
  await page.getByLabel(copy({ key: BackofficeCopyKey.SignInCodeLabel })).fill(input.code);
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.SignInCodeSubmit }) }).click();
}

export async function signIn(input: { page: Page }): Promise<void> {
  const { page } = input;
  await page.goto('/');
  await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
  await fillCodeStep({ page, code: await freshCode() });
  await expect(page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.HomeTitle }) })).toBeVisible();
}
