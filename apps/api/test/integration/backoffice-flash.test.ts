import { MINUTE_MS, SECOND_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { testEnv } from '../support/workers-env';
import { signIn } from './backoffice-auth-fixtures';
import {
  ACCESS_TOKEN,
  APP_SECRET,
  endBackofficeSession,
  getPage,
  nextCode,
  postAction,
  PHONE_NUMBER_ID,
  REGISTER_PATH,
  registrationFields,
  startBackofficeSession,
  submitRejectedAction,
} from './backoffice-numbers-fixtures';

const WRONG_CODE = '987654';
const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;

let sessionToken: string;

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
});

afterEach(endBackofficeSession);

async function rejectRegistration(): Promise<{ posted: Response; followed: Response }> {
  return submitRejectedAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}), code: WRONG_CODE });
}

async function expectCleanForm(input: { response: Response }): Promise<void> {
  expect(input.response.status).toBe(STATUS_OK);
  expect(await input.response.text()).not.toContain(PHONE_NUMBER_ID);
}

describe('the flash of a rejected form', () => {
  test('shows the rejection and the typed non-secret values on the redirected GET', async () => {
    const { posted, followed } = await rejectRegistration();
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await followed.text()).toContain(PHONE_NUMBER_ID);
  });

  test('is shown once: a second GET of the same page is the clean form', async () => {
    await rejectRegistration();
    await expectCleanForm({ response: await getPage({ path: REGISTER_PATH, sessionToken }) });
  });

  test('is gone after a minute', async () => {
    const posted = await postAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}), code: WRONG_CODE });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    vi.setSystemTime(Date.now() + MINUTE_MS + SECOND_MS);
    await expectCleanForm({ response: await getPage({ path: REGISTER_PATH, sessionToken }) });
  });

  test('belongs to the session that was rejected', async () => {
    await rejectRegistration();
    await nextCode();
    const other = await signIn({});
    await expectCleanForm({ response: await getPage({ path: REGISTER_PATH, sessionToken: other.sessionToken }) });
  });

  test('stores no secret, no code and no token', async () => {
    await postAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}), code: WRONG_CODE });
    const rows = await testEnv.CONNECTIONS.prepare('SELECT * FROM backoffice_sessions').all<Record<string, unknown>>();
    const stored = JSON.stringify(rows.results);
    expect(stored).toContain(PHONE_NUMBER_ID);
    [ACCESS_TOKEN, APP_SECRET, WRONG_CODE].forEach((secret) => expect(stored).not.toContain(secret));
  });
});
