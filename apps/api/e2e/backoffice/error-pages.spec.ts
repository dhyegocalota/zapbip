import { HttpStatus } from '@zapbip/types';
import { CLIENT_ADDRESS_HEADER } from '../../src/contract/constants';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { BACKOFFICE_TEST_EMAIL, BACKOFFICE_TEST_PASSWORD } from '../../test/support/backoffice-credentials';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { clearSessions } from './support/operator-database';
import { fillPasswordStep, signIn } from './support/sign-in';

const RATE_LIMIT_ATTEMPTS = 6;
const WRONG_PASSWORD = 'not the operator password';
const FOREIGN_ORIGIN = 'http://evil.localhost';
const FOREIGN_CSRF_TOKEN = 'not-a-form-token';

test('shows the not found page for an unknown path', async ({ page }) => {
  const response = await page.goto('/nowhere');
  expect(response?.status()).toBe(HttpStatus.NotFound);
  await expect(
    page.getByRole('heading', { level: 1, name: `${HttpStatus.NotFound} ${copy({ key: BackofficeCopyKey.Error404Title })}` }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: copy({ key: BackofficeCopyKey.ErrorHomeAction }) })).toBeVisible();
});

test('shows the too many attempts page once the sign-in rate limit is spent', async ({ page }) => {
  await page.goto('/sign-in');
  await Array.from({ length: RATE_LIMIT_ATTEMPTS }).reduce<Promise<void>>(async (previous) => {
    await previous;
    await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD });
  }, Promise.resolve());
  await expect(
    page.getByRole('heading', { level: 1, name: `${HttpStatus.TooManyRequests} ${copy({ key: BackofficeCopyKey.Error429Title })}` }),
  ).toBeVisible();
});

test('shows the refused page for a sign-in posted from another origin', async ({ request, network }) => {
  const response = await request.post('/sign-in', {
    headers: { Origin: FOREIGN_ORIGIN, [CLIENT_ADDRESS_HEADER]: network.address() },
    form: { email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD, csrf: FOREIGN_CSRF_TOKEN },
  });
  expect(response.status()).toBe(HttpStatus.Forbidden);
  expect(await response.text()).toContain(copy({ key: BackofficeCopyKey.Error403Title }));
});

test('shows the unauthorized page for a post without a session', async ({ page }) => {
  await signIn({ page });
  clearSessions();
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.SignOut }) }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `${HttpStatus.Unauthorized} ${copy({ key: BackofficeCopyKey.Error401Title })}` }),
  ).toBeVisible();
});
