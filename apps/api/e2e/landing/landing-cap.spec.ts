import { expect as baseExpect } from '@playwright/test';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { BACKOFFICE_TEST_EMAIL, BACKOFFICE_TEST_PASSWORD } from '../../test/support/backoffice-credentials';
import { copy as backofficeCopy } from '../backoffice/support/copy';
import { clearSessions, freshCode } from '../backoffice/support/operator-database';
import { fillCodeStep, fillPasswordStep } from '../backoffice/support/sign-in';
import { expect, joinThroughApi, test } from './fixtures';
import { rowOf, storedCap } from './support/landing-database';
import { LandingVariable, landingValue } from './support/landing-environment';

const NEW_CAP = 2;

function waitlistUrl(): string {
  return `${landingValue({ variable: LandingVariable.BackofficeOrigin })}/waitlist`;
}

async function signInToBackoffice(input: { page: import('@playwright/test').Page }): Promise<void> {
  const { page } = input;
  clearSessions();
  await page.goto(waitlistUrl());
  await fillPasswordStep({ page, email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
  await fillCodeStep({ page, code: await freshCode() });
  await baseExpect(page.getByRole('heading', { level: 1, name: backofficeCopy({ key: BackofficeCopyKey.HomeTitle }) })).toBeVisible();
  await page.goto(waitlistUrl());
}

async function saveCap(input: { page: import('@playwright/test').Page; cap: number; code: string }): Promise<void> {
  const { page, cap, code } = input;
  await page.getByLabel(backofficeCopy({ key: BackofficeCopyKey.WaitlistCapField })).fill(String(cap));
  await page.locator('#waitlist-cap-code').fill(code);
  await page.getByRole('button', { name: backofficeCopy({ key: BackofficeCopyKey.WaitlistCapSubmit }) }).click();
}

test.use({ locale: 'pt-BR' });

test('cap edited in the backoffice applies with no deploy', async ({ page, request }) => {
  await signInToBackoffice({ page });
  await saveCap({ page, cap: NEW_CAP, code: await freshCode() });
  await expect(page.getByText(backofficeCopy({ key: BackofficeCopyKey.WaitlistCapSaved }))).toBeVisible();
  expect(storedCap()).toBe(NEW_CAP);
  await joinThroughApi({ request, email: 'referrer@example.com' });
  const code = rowOf({ email: 'referrer@example.com' }).referral_code;
  await Array.from({ length: NEW_CAP + 1 }, (_, index) => index).reduce(async (previous, index) => {
    await previous;
    await joinThroughApi({ request, email: `friend${index}@example.com`, referralCode: code });
  }, Promise.resolve());
  expect(rowOf({ email: `friend${NEW_CAP}@example.com` })).toMatchObject({ credited: 0 });
  await page.goto(waitlistUrl());
  await expect(page.getByText('friend0@example.com')).toBeVisible();
  await expect(page.locator('.figure-value[data-total]')).toHaveAttribute('data-total', String(NEW_CAP + 2));
});

test('cap change without a step-up code is refused', async ({ page }) => {
  await signInToBackoffice({ page });
  await saveCap({ page, cap: NEW_CAP, code: '000000' });
  await expect(page.getByText(backofficeCopy({ key: BackofficeCopyKey.StepUpRejected }))).toBeVisible();
  expect(storedCap()).toBe(5);
});
