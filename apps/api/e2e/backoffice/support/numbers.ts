import { expect, type Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../../src/backoffice/backoffice-copy';
import { NEW_META_APP_VALUE } from '../../../src/backoffice/numbers/number-form-fields';
import { GRAPH_API_VERSION } from '../../../src/adapters/whatsapp/whatsapp-constants';
import type { FakeGraph } from '../../../test/support/fake-graph';
import { copy } from './copy';
import { freshCode } from './operator-database';

const FIRST_PHONE_NUMBER_ID = 1_000_000_000_000_000;
const FIRST_WABA_ID = 3_000_000_000_000_000;
const FIRST_META_APP_ID = 5_000_000_000_000;
const FIRST_DISPLAY_NUMBER = 5_511_977_770_000;
const OK_STATUS = 200;
const VERIFIED_NAME = 'Maria Atendimento';
const QUALITY_RATING = 'GREEN';

export type WalkNumber = {
  metaAppId: string;
  metaAppName: string;
  appSecret: string;
  phoneNumberId: string;
  wabaId: string;
  displayNumber: string;
  label: string;
  accessToken: string;
};

export function walkNumberOf(input: { index: number }): WalkNumber {
  const { index } = input;
  return {
    metaAppId: String(FIRST_META_APP_ID + index),
    metaAppName: `Meta app ${index}`,
    appSecret: `walk-app-secret-${index}`,
    phoneNumberId: String(FIRST_PHONE_NUMBER_ID + index),
    wabaId: String(FIRST_WABA_ID + index),
    displayNumber: `+${FIRST_DISPLAY_NUMBER + index}`,
    label: `Walk number ${index}`,
    accessToken: `walk-access-token-${index}`,
  };
}

export function credentialTextsOf(input: { number: WalkNumber }): string[] {
  return [input.number.appSecret, input.number.accessToken];
}

export async function fillCode(input: { page: Page; id: string; code: string }): Promise<void> {
  await input.page.locator(`#${input.id}`).fill(input.code);
}

export async function registerNumber(input: { page: Page; number: WalkNumber; code: string }): Promise<void> {
  const { page, number } = input;
  const field = (key: BackofficeCopyKey) => page.getByLabel(copy({ key }), { exact: true });
  await page.goto('/numbers/new');
  await page.getByLabel(copy({ key: BackofficeCopyKey.RegisterMetaAppLabel }), { exact: true }).selectOption(NEW_META_APP_VALUE);
  await field(BackofficeCopyKey.RegisterMetaAppIdLabel).fill(number.metaAppId);
  await field(BackofficeCopyKey.RegisterMetaAppNameLabel).fill(number.metaAppName);
  await field(BackofficeCopyKey.RegisterAppSecretLabel).fill(number.appSecret);
  await field(BackofficeCopyKey.RegisterPhoneNumberIdLabel).fill(number.phoneNumberId);
  await field(BackofficeCopyKey.RegisterWabaIdLabel).fill(number.wabaId);
  await field(BackofficeCopyKey.RegisterDisplayNumberLabel).fill(number.displayNumber);
  await field(BackofficeCopyKey.RegisterLabelLabel).fill(number.label);
  await field(BackofficeCopyKey.RegisterAccessTokenLabel).fill(number.accessToken);
  await fillCode({ page, id: 'register-code', code: input.code });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.RegisterSubmit }) }).click();
}

export async function registerNumberWithFreshCode(input: { page: Page; number: WalkNumber }): Promise<void> {
  const { page, number } = input;
  await registerNumber({ page, number, code: await freshCode() });
  await expect(page.getByRole('heading', { level: 1, name: number.label })).toBeVisible();
}

export async function queueMatchingVerification(input: { fakeGraph: FakeGraph; number: WalkNumber }): Promise<void> {
  const { fakeGraph, number } = input;
  await fakeGraph.respondWith({
    method: 'GET',
    path: `/${GRAPH_API_VERSION}/${number.phoneNumberId}`,
    status: OK_STATUS,
    body: { display_phone_number: number.displayNumber, verified_name: VERIFIED_NAME, quality_rating: QUALITY_RATING },
  });
  await fakeGraph.respondWith({
    method: 'GET',
    path: `/${GRAPH_API_VERSION}/${number.wabaId}/message_templates`,
    status: OK_STATUS,
    body: { data: [] },
  });
}

export async function verifyNumber(input: { page: Page; fakeGraph: FakeGraph; number: WalkNumber }): Promise<void> {
  const { page, fakeGraph, number } = input;
  await queueMatchingVerification({ fakeGraph, number });
  await fillCode({ page, id: 'verify-code', code: await freshCode() });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.NumberVerifySubmit }) }).click();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.VerifyOk }))).toBeVisible();
  await page.getByRole('link', { name: copy({ key: BackofficeCopyKey.VerifyBack, values: { label: number.label } }) }).click();
}

export async function changeState(input: { page: Page; optionKey: BackofficeCopyKey; code: string }): Promise<void> {
  const { page } = input;
  await page.getByRole('radio', { name: copy({ key: input.optionKey }) }).check();
  await fillCode({ page, id: 'state-code', code: input.code });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.NumberStateSubmit }) }).click();
}

export async function activateNumber(input: { page: Page; fakeGraph: FakeGraph; number: WalkNumber }): Promise<void> {
  const { page, fakeGraph, number } = input;
  await registerNumberWithFreshCode({ page, number });
  await verifyNumber({ page, fakeGraph, number });
  await changeState({ page, optionKey: BackofficeCopyKey.NumberStateOptionActive, code: await freshCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.NoticeStateChanged }))).toBeVisible();
}
