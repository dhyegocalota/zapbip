import { DEFAULT_WAITLIST_REFERRAL_CAP } from '@zapbip/types';
import { TURNSTILE_FAILED_CALLBACK, TURNSTILE_PASSED_CALLBACK } from '../../src/site/site-constants';
import { SiteCopyKey } from '../../src/site/site-copy';
import { expect, joinThroughApi, test } from './fixtures';
import { rowOf, waitlistRows } from './support/landing-database';
import { siteCopy } from './support/site-copy';

const MARIA = 'maria@example.com';
const CLEAR_TOKEN_SCRIPT = "document.querySelector('input[name=\"cf-turnstile-response\"]').value = ''";
const FAIL_CHECK_SCRIPT = `window['${TURNSTILE_FAILED_CALLBACK}']()`;
const PASS_CHECK_SCRIPT = `document.querySelector('input[name="cf-turnstile-response"]').value = 'passed'; window['${TURNSTILE_PASSED_CALLBACK}']()`;
const SKIP_NATIVE_VALIDATION_SCRIPT = "document.querySelector('.join-form').setAttribute('novalidate', '')";

const THANKS_PATTERN = /<div class="thanks[\s\S]*?<\/p>/;

function thanksOf(html: string): string {
  return THANKS_PATTERN.exec(html)![0];
}

test('join with the test widget', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(siteCopy({ key: SiteCopyKey.JoinEmailLabel })).fill(MARIA);
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('');
  await page.getByRole('button', { name: siteCopy({ key: SiteCopyKey.JoinSubmit }) }).click();
  await expect(page.getByRole('heading', { name: siteCopy({ key: SiteCopyKey.ThanksTitle }) })).toBeVisible();
  await expect(page.getByText(siteCopy({ key: SiteCopyKey.ThanksBody }))).toBeVisible();
  await expect(page.locator('#invite-link, .copy-link, .invite-meter')).toHaveCount(0);
  expect(rowOf({ email: MARIA })).toMatchObject({ credited: 0 });
});

test('a failed check shows the captcha notice on the page and writes nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(siteCopy({ key: SiteCopyKey.JoinEmailLabel })).fill(MARIA);
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('');
  await page.evaluate(CLEAR_TOKEN_SCRIPT);
  await page.route('**/join', (route) => route.abort());
  const submit = page.getByRole('button', { name: siteCopy({ key: SiteCopyKey.JoinSubmit }) });
  await submit.click();
  await expect(page.locator('.join-submit')).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(FAIL_CHECK_SCRIPT);
  await expect(page.getByText(siteCopy({ key: SiteCopyKey.JoinCaptchaFailed }))).toBeVisible();
  await expect(page.locator('.join-submit')).not.toHaveAttribute('aria-busy', 'true');
  expect(waitlistRows()).toEqual([]);
});

test('a click before the check is solved waits and sends the form by itself once it passes', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(siteCopy({ key: SiteCopyKey.JoinEmailLabel })).fill(MARIA);
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('');
  await page.evaluate(CLEAR_TOKEN_SCRIPT);
  await page.getByRole('button', { name: siteCopy({ key: SiteCopyKey.JoinSubmit }) }).click();
  await expect(page.locator('.join-submit')).toHaveAttribute('aria-busy', 'true');
  expect(waitlistRows()).toEqual([]);
  await page.evaluate(PASS_CHECK_SCRIPT);
  await expect(page.getByRole('heading', { name: siteCopy({ key: SiteCopyKey.ThanksTitle }) })).toBeVisible();
  expect(rowOf({ email: MARIA })).toBeDefined();
});

test('rejected input keeps the typed value and shows the field error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(siteCopy({ key: SiteCopyKey.JoinEmailLabel })).fill('not-an-email');
  await page.evaluate(SKIP_NATIVE_VALIDATION_SCRIPT);
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('');
  await page.getByRole('button', { name: siteCopy({ key: SiteCopyKey.JoinSubmit }) }).click();
  await expect(page.getByText(siteCopy({ key: SiteCopyKey.JoinEmailInvalid }))).toBeVisible();
  await expect(page.locator('#join-email')).toHaveValue('not-an-email');
  expect(waitlistRows()).toEqual([]);
});

test('duplicate email gives the same thank-you and one row', async ({ request }) => {
  const first = await joinThroughApi({ request, email: MARIA });
  const second = await joinThroughApi({ request, email: MARIA });
  expect(second).toBe(first);
  expect(waitlistRows()).toHaveLength(1);
});

test('referral credit up to the cap, then uncredited', async ({ request }) => {
  await joinThroughApi({ request, email: 'referrer@example.com' });
  const code = rowOf({ email: 'referrer@example.com' }).referral_code;
  await Array.from({ length: DEFAULT_WAITLIST_REFERRAL_CAP + 1 }, (_, index) => index).reduce(async (previous, index) => {
    await previous;
    await joinThroughApi({ request, email: `friend${index}@example.com`, referralCode: code });
  }, Promise.resolve());
  const credited = waitlistRows().filter((row) => row.referred_by === code && row.credited === 1);
  expect(credited).toHaveLength(DEFAULT_WAITLIST_REFERRAL_CAP);
  expect(rowOf({ email: `friend${DEFAULT_WAITLIST_REFERRAL_CAP}@example.com` })).toMatchObject({ credited: 0, referred_by: code });
});

test('self-referral is a duplicate and credits nothing', async ({ request }) => {
  const first = await joinThroughApi({ request, email: MARIA });
  const code = rowOf({ email: MARIA }).referral_code;
  const second = await joinThroughApi({ request, email: MARIA, referralCode: code });
  expect(thanksOf(second)).toBe(thanksOf(first));
  expect(waitlistRows().filter((row) => row.credited === 1)).toEqual([]);
});
