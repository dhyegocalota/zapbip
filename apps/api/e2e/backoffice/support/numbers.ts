import { expect, type Locator, type Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../../src/backoffice/backoffice-copy';
import { GRAPH_API_VERSION } from '../../../src/adapters/whatsapp/whatsapp-constants';
import { digitsOf } from '../../../src/numbers/number-verification';
import { fakeReportedDisplayNumberOf, type FakeGraph } from '../../../test/support/fake-graph';
import { copy } from './copy';
import { useEmbeddedSignupStub, SignupOutcome } from './embedded-signup-stub';
import { freshCode } from './operator-database';

const FIRST_PHONE_NUMBER_ID = 1_000_000_000_000_000;
const FIRST_WABA_ID = 3_000_000_000_000_000;
const OK_STATUS = 200;
const STATE_BADGE_SELECTOR = '.state-badge';
const VERIFIED_NAME = 'Maria Atendimento';
const QUALITY_RATING = 'GREEN';
const WALK_PIN = '482915';
const CONNECT_CODE_FIELD = 'connect-code';

export type WalkNumber = {
  phoneNumberId: string;
  wabaId: string;
  displayNumber: string;
  reportedDisplayNumber: string;
  label: string;
  pin: string;
  signupCode: string;
};

export function walkNumberOf(input: { index: number }): WalkNumber {
  const { index } = input;
  const phoneNumberId = String(FIRST_PHONE_NUMBER_ID + index);
  const reportedDisplayNumber = fakeReportedDisplayNumberOf({ phoneNumberId });
  return {
    phoneNumberId,
    wabaId: String(FIRST_WABA_ID + index),
    displayNumber: `+${digitsOf({ value: reportedDisplayNumber })}`,
    reportedDisplayNumber,
    label: `Walk number ${index}`,
    pin: WALK_PIN,
    signupCode: `walk-signup-code-${index}`,
  };
}

export function credentialTextsOf(input: { number: WalkNumber }): string[] {
  return [input.number.pin, input.number.signupCode];
}

export async function fillCode(input: { page: Page; id: string; code: string }): Promise<void> {
  await input.page.locator(`#${input.id}`).fill(input.code);
}

export async function stepUpToConnect(input: { page: Page; code: string }): Promise<void> {
  const { page } = input;
  await page.goto('/numbers/connect');
  await fillCode({ page, id: CONNECT_CODE_FIELD, code: input.code });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.ConnectContinue }) }).click();
}

export async function connectNumber(input: { page: Page; number: WalkNumber; outcome?: SignupOutcome; code: string }): Promise<string[]> {
  const { page, number, outcome = SignupOutcome.Finish } = input;
  const violations = await useEmbeddedSignupStub({
    page,
    stub: { outcome, code: number.signupCode, phoneNumberId: number.phoneNumberId, wabaId: number.wabaId },
  });
  await stepUpToConnect({ page, code: input.code });
  await page.getByLabel(copy({ key: BackofficeCopyKey.ConnectLabelLabel }), { exact: true }).fill(number.label);
  await page.getByLabel(copy({ key: BackofficeCopyKey.ConnectPinLabel }), { exact: true }).fill(number.pin);
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.ConnectButton }) }).click();
  return violations;
}

export async function connectNumberWithFreshCode(input: { page: Page; number: WalkNumber }): Promise<void> {
  const { page, number } = input;
  await connectNumber({ page, number, code: await freshCode() });
  await expect(page.getByRole('heading', { level: 1, name: number.label })).toBeVisible();
}

export async function queueMatchingVerification(input: { fakeGraph: FakeGraph; number: WalkNumber }): Promise<void> {
  const { fakeGraph, number } = input;
  await fakeGraph.respondWith({
    method: 'GET',
    path: `/${GRAPH_API_VERSION}/${number.phoneNumberId}`,
    status: OK_STATUS,
    body: { display_phone_number: number.reportedDisplayNumber, verified_name: VERIFIED_NAME, quality_rating: QUALITY_RATING },
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
  await connectNumberWithFreshCode({ page, number });
  await verifyNumber({ page, fakeGraph, number });
  await changeState({ page, optionKey: BackofficeCopyKey.NumberStateOptionActive, code: await freshCode() });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.NoticeStateChanged }))).toBeVisible();
}

export function stateBadgeOf(input: { page: Page; key: BackofficeCopyKey }): Locator {
  return input.page.locator(STATE_BADGE_SELECTOR).filter({ hasText: copy({ key: input.key }) });
}
