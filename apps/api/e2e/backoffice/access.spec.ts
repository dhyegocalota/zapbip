import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ACCESS_BATCH_LIMIT } from '@zapbip/types';
import type { Page, TestInfo } from '@playwright/test';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { maskedPhoneOf } from '@zapbip/core';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { seedAccess, WAITING_PHONES, WAITLIST_EMAILS } from './support/access-seed';
import { expectNoHorizontalScroll } from './support/layout';
import { freshCode, wrongCode } from './support/operator-database';
import { signIn } from './support/sign-in';

const SHOT_DIRECTORY_VARIABLE = 'ACCESS_RELEASE_SHOT_DIRECTORY';
const DESKTOP_WIDTH = 1440;
const DESKTOP_HEIGHT = 900;
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;
const DESKTOP_PROJECT = 'desktop';
const RELEASE_CODE_FIELD = '#access-release-code';
const INVITE_CODE_FIELD = '#access-invite-code';

test.beforeEach(async ({ page }, testInfo) => {
  const isDesktop = testInfo.project.name === DESKTOP_PROJECT;
  await page.setViewportSize(isDesktop ? { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT } : { width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
  seedAccess();
  await signIn({ page });
});

async function shoot(input: { page: Page; testInfo: TestInfo; name: string }): Promise<void> {
  const directory = process.env[SHOT_DIRECTORY_VARIABLE];
  if (directory === undefined) return;
  await mkdir(directory, { recursive: true });
  await input.page.screenshot({ path: join(directory, `${input.testInfo.project.name}-${input.name}.png`), fullPage: true });
}

async function openAccess(input: { page: Page }): Promise<void> {
  await input.page
    .getByRole('link', { name: copy({ key: BackofficeCopyKey.NavigationAccess }), exact: true })
    .first()
    .click();
  await expect(input.page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.AccessTitle }) })).toBeVisible();
}

test('releases the ticked accounts in one batch and reports how each was told', async ({ page }, testInfo) => {
  await openAccess({ page });
  await expect(page.locator('input[name="account"]')).toHaveCount(WAITING_PHONES.length);
  await expect(page.getByText(maskedPhoneOf({ waId: WAITING_PHONES[0]! }))).toBeVisible();
  await expect(page.getByText(WAITING_PHONES[0]!)).toHaveCount(0);
  await expectNoHorizontalScroll({ page });
  await shoot({ page, testInfo, name: 'access-list' });
  await page.locator('input[name="account"]').nth(0).check();
  await page.locator('input[name="account"]').nth(1).check();
  await page.locator(RELEASE_CODE_FIELD).fill(await freshCode());
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AccessReleaseSubmit }) }).click();
  await expect(page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.AccessReleaseResultTitle }) })).toBeVisible();
  await expect(page.locator('[data-count="released"]')).toHaveText('2');
  await expect(page.locator('[data-count="queued"]')).toHaveText('2');
  await expect(page.locator('[data-count="failed"]')).toHaveText('0');
  await expectNoHorizontalScroll({ page });
  await shoot({ page, testInfo, name: 'access-release-result' });
  await page.getByRole('link', { name: copy({ key: BackofficeCopyKey.AccessResultBack }) }).click();
  await expect(page.locator('input[name="account"]')).toHaveCount(WAITING_PHONES.length - 2);
});

test('releases everyone matching the filters up to the batch limit with select all', async ({ page }) => {
  await openAccess({ page });
  await page.locator('input[name="select_all"]').first().check();
  await page.locator(RELEASE_CODE_FIELD).fill(await freshCode());
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AccessReleaseSubmit }) }).click();
  await expect(page.locator('[data-count="released"]')).toHaveText(String(Math.min(WAITING_PHONES.length, ACCESS_BATCH_LIMIT)));
});

test('keeps everything waiting after a wrong code', async ({ page }, testInfo) => {
  await openAccess({ page });
  await page.locator('input[name="account"]').nth(0).check();
  await page.locator(RELEASE_CODE_FIELD).fill(await wrongCode());
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AccessReleaseSubmit }) }).click();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.StepUpRejected }))).toBeVisible();
  await expect(page.locator('input[name="account"]')).toHaveCount(WAITING_PHONES.length);
  await shoot({ page, testInfo, name: 'access-wrong-code' });
});

test('invites email entries and shows the links once with a CSV download', async ({ page }, testInfo) => {
  await openAccess({ page });
  await expect(page.locator('input[name="email"]')).toHaveCount(WAITLIST_EMAILS.length);
  await page.locator('input[name="email"]').nth(0).check();
  await page.locator(INVITE_CODE_FIELD).fill(await freshCode());
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AccessInviteSubmit }) }).click();
  await expect(page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.AccessInviteResultTitle }) })).toBeVisible();
  await expect(page.locator('[data-count="issued"]')).toHaveText('1');
  await expect(page.locator('textarea.access-links')).toHaveValue(/https:\/\/wa\.me\/\d+\?text=.*zbi_[a-z0-9]{24}/);
  await expectNoHorizontalScroll({ page });
  await shoot({ page, testInfo, name: 'access-invite-result' });
  await expect(page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AccessInviteDownload }) })).toBeVisible();
  await expect(page.locator('form[action="/access/invites.csv"] input[name="links"]')).toHaveValue(
    /^first@example\.com,https:\/\/wa\.me\//,
  );
  await page.getByRole('link', { name: copy({ key: BackofficeCopyKey.AccessResultBack }) }).click();
  await expect(page.locator('input[name="email"]')).toHaveCount(WAITLIST_EMAILS.length - 1);
});
