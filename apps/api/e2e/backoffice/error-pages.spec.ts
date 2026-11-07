import { HttpStatus } from '@zapbip/types';
import { CLIENT_ADDRESS_HEADER } from '../../src/backoffice/backoffice-constants';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { BACKOFFICE_TEST_KEY } from '../../test/support/backoffice-credentials';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { wrongCode } from './support/operator-database';
import { fillSignIn } from './support/sign-in';

const RATE_LIMIT_ATTEMPTS = 6;
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
  const wrong = await wrongCode();
  await Array.from({ length: RATE_LIMIT_ATTEMPTS }).reduce<Promise<void>>(async (previous) => {
    await previous;
    await fillSignIn({ page, key: BACKOFFICE_TEST_KEY, code: wrong });
  }, Promise.resolve());
  await expect(
    page.getByRole('heading', { level: 1, name: `${HttpStatus.TooManyRequests} ${copy({ key: BackofficeCopyKey.Error429Title })}` }),
  ).toBeVisible();
});

test('shows the refused page for a sign-in posted from another origin', async ({ request, network }) => {
  const response = await request.post('/sign-in', {
    headers: { Origin: FOREIGN_ORIGIN, [CLIENT_ADDRESS_HEADER]: network.address() },
    form: { key: BACKOFFICE_TEST_KEY, code: await wrongCode(), csrf: FOREIGN_CSRF_TOKEN },
  });
  expect(response.status()).toBe(HttpStatus.Forbidden);
  expect(await response.text()).toContain(copy({ key: BackofficeCopyKey.Error403Title }));
});
