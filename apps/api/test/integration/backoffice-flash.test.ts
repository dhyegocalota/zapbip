import { MINUTE_MS, SECOND_MS, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { OwnerLocale } from '@zapbip/types';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { signIn } from './backoffice-auth-fixtures';
import {
  ACCESS_TOKEN,
  endBackofficeSession,
  getPage,
  nextCode,
  postAction,
  startBackofficeSession,
  submitRejectedAction,
} from './backoffice-numbers-fixtures';

const NUMBER_ID = 'num_flash';
const NUMBER_PATH = `/numbers/${NUMBER_ID}`;
const WRONG_CODE = '987654';
const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];

let sessionToken: string;

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await seedWhatsAppNumber({ numberId: NUMBER_ID, accessToken: ACCESS_TOKEN, state: WhatsAppNumberState.Active });
});

afterEach(endBackofficeSession);

function rejectStateChange(): Promise<{ posted: Response; followed: Response }> {
  return submitRejectedAction({
    path: `${NUMBER_PATH}/state`,
    sessionToken,
    fields: { [NumberFormField.State]: WhatsAppNumberState.Closed },
    code: WRONG_CODE,
  });
}

async function expectCleanPage(input: { response: Response }): Promise<void> {
  expect(input.response.status).toBe(STATUS_OK);
  expect(await input.response.text()).not.toContain(copy[BackofficeCopyKey.StepUpRejected]);
}

describe('the flash of a rejected form', () => {
  test('shows the rejection on the redirected GET', async () => {
    const { posted, followed } = await rejectStateChange();
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.StepUpRejected]);
  });

  test('is shown once: a second GET of the same page is the clean page', async () => {
    await rejectStateChange();
    await expectCleanPage({ response: await getPage({ path: NUMBER_PATH, sessionToken }) });
  });

  test('is gone after a minute', async () => {
    const posted = await postAction({
      path: `${NUMBER_PATH}/state`,
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Closed },
      code: WRONG_CODE,
    });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    vi.setSystemTime(Date.now() + MINUTE_MS + SECOND_MS);
    await expectCleanPage({ response: await getPage({ path: NUMBER_PATH, sessionToken }) });
  });

  test('belongs to the session that was rejected', async () => {
    await rejectStateChange();
    await nextCode();
    const other = await signIn({});
    await expectCleanPage({ response: await getPage({ path: NUMBER_PATH, sessionToken: other.sessionToken }) });
  });

  test('stores no secret, no code and no token', async () => {
    await postAction({
      path: `${NUMBER_PATH}/state`,
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Closed },
      code: WRONG_CODE,
    });
    const rows = await testEnv.CONNECTIONS.prepare('SELECT * FROM backoffice_sessions').all<Record<string, unknown>>();
    const stored = JSON.stringify(rows.results);
    [ACCESS_TOKEN, WRONG_CODE].forEach((secret) => expect(stored).not.toContain(secret));
  });
});
