import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { SignupOutcome } from './support/embedded-signup-stub';
import {
  connectNumber,
  connectNumberWithFreshCode,
  credentialTextsOf,
  stateBadgeOf,
  stepUpToConnect,
  walkNumberOf,
} from './support/numbers';
import { freshCode } from './support/operator-database';
import { signIn } from './support/sign-in';

const META_PATH = /\/numbers\/connect\/meta$/;
const CONNECT_PATH = /\/numbers\/connect$/;

test.beforeEach(({ page }) => signIn({ page }));

test('connects a number through the stubbed Embedded Signup with no console error and no policy violation', async ({ page }) => {
  const number = walkNumberOf({ index: 1 });
  const violations = await connectNumber({ page, number, code: await freshCode() });
  await expect(page.getByRole('heading', { level: 1, name: number.label })).toBeVisible();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.NoticeRegistered }))).toBeVisible();
  await expect(stateBadgeOf({ page, key: BackofficeCopyKey.StatePending })).toBeVisible();
  await expect(page.getByText(number.displayNumber)).toBeVisible();
  const content = await page.content();
  credentialTextsOf({ number }).forEach((secret) => expect(content).not.toContain(secret));
  expect(violations).toEqual([]);
});

test('a cancelled signup shows the cancel line and posts nothing', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await connectNumber({ page, number: walkNumberOf({ index: 1 }), outcome: SignupOutcome.Cancel, code: await freshCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.ConnectStatusCancelled }))).toBeVisible();
  await expect(page).toHaveURL(META_PATH);
  expect(posts.filter((url) => url.endsWith('/numbers/connect/meta'))).toEqual([]);
});

test('ignores a signup message from a foreign origin', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await connectNumber({ page, number: walkNumberOf({ index: 1 }), outcome: SignupOutcome.ForeignOrigin, code: await freshCode() });
  await expect(page.locator('#connect-status')).toBeHidden();
  await expect(page).toHaveURL(META_PATH);
  expect(posts.filter((url) => url.endsWith('/numbers/connect/meta'))).toEqual([]);
});

test('opening the onboarding page without a grant lands on the step-up', async ({ page }) => {
  await page.goto('/numbers/connect/meta');
  await expect(page).toHaveURL(CONNECT_PATH);
});

test('a wrong step-up code stays on the step-up with the rejection', async ({ page }) => {
  await stepUpToConnect({ page, code: '000000' });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.StepUpRejected }))).toBeVisible();
  await expect(page).toHaveURL(CONNECT_PATH);
});

test('browser Back after the number page returns to the step-up because the grant is spent', async ({ page }) => {
  const number = walkNumberOf({ index: 1 });
  await connectNumberWithFreshCode({ page, number });
  await page.goto('/numbers/connect/meta');
  await expect(page).toHaveURL(CONNECT_PATH);
});
