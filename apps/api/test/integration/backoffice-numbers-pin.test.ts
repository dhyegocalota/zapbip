import { OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import {
  endBackofficeSession,
  followRedirect,
  getPage,
  postAction,
  refusingStepUpEnv,
  startBackofficeSession,
} from './backoffice-numbers-fixtures';

const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const STATUS_TOO_MANY_REQUESTS = 429;
const PINNED_NUMBER_ID = 'num_pinned';
const UNPINNED_NUMBER_ID = 'num_unpinned';
const TWO_STEP_PIN = '730194';
const WRONG_CODE = '000000';
const AUDIT_ACTION = 'number.pin_revealed';
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];

let sessionToken: string;

function pinPath(input: { numberId: string }): string {
  return `/numbers/${input.numberId}/pin`;
}

function revealPin(input: { numberId: string; code?: string }): Promise<Response> {
  return postAction({ path: pinPath({ numberId: input.numberId }), sessionToken, fields: {}, code: input.code });
}

async function auditOutcomes(): Promise<string[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT outcome FROM backoffice_audit WHERE action = ? ORDER BY at, rowid')
    .bind(AUDIT_ACTION)
    .all<{ outcome: string }>();
  return results.map((row) => row.outcome);
}

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await seedWhatsAppNumber({
    numberId: PINNED_NUMBER_ID,
    phoneNumberId: '1000000000801',
    wabaId: '3000000000801',
    state: WhatsAppNumberState.Pending,
    twoStepPin: TWO_STEP_PIN,
  });
  await seedWhatsAppNumber({
    numberId: UNPINNED_NUMBER_ID,
    phoneNumberId: '1000000000802',
    wabaId: '3000000000802',
    displayNumber: '5511977770802',
    state: WhatsAppNumberState.Pending,
  });
});

afterEach(endBackofficeSession);

describe('showing the two-step PIN of a number', () => {
  test('a fresh code renders the PIN once with no-store and audits it as succeeded', async () => {
    const response = await revealPin({ numberId: PINNED_NUMBER_ID });
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toContain(TWO_STEP_PIN);
    expect(await auditOutcomes()).toEqual(['succeeded']);
  });

  test('the detail page offers the button for a stored PIN and says not stored otherwise, never showing the PIN', async () => {
    const pinned = await (await getPage({ path: `/numbers/${PINNED_NUMBER_ID}`, sessionToken })).text();
    const unpinned = await (await getPage({ path: `/numbers/${UNPINNED_NUMBER_ID}`, sessionToken })).text();
    expect(pinned).toContain(pinPath({ numberId: PINNED_NUMBER_ID }));
    expect(pinned).not.toContain(TWO_STEP_PIN);
    expect(unpinned).toContain(copy[BackofficeCopyKey.NumberPinNotStored]);
    expect(unpinned).not.toContain(pinPath({ numberId: UNPINNED_NUMBER_ID }));
  });

  test('a wrong code is refused like the other step-up forms, shows no PIN and audits it as failed', async () => {
    const posted = await revealPin({ numberId: PINNED_NUMBER_ID, code: WRONG_CODE });
    const followed = await followRedirect({ posted, sessionToken });
    const body = await followed.text();
    expect(posted.headers.get('Location')).toBe(`/numbers/${PINNED_NUMBER_ID}`);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(body).toContain(copy[BackofficeCopyKey.StepUpRejected]);
    expect(body).not.toContain(TWO_STEP_PIN);
    expect(await auditOutcomes()).toEqual(['failed']);
  });

  test('a refusing rate limiter answers 429 and shows no PIN', async () => {
    const response = await postAction({
      path: pinPath({ numberId: PINNED_NUMBER_ID }),
      sessionToken,
      fields: {},
      env: refusingStepUpEnv(),
    });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(await response.text()).not.toContain(TWO_STEP_PIN);
  });

  test('a number with no stored PIN answers 404', async () => {
    const response = await revealPin({ numberId: UNPINNED_NUMBER_ID });
    expect(response.status).toBe(STATUS_NOT_FOUND);
    expect(await auditOutcomes()).toEqual([]);
  });
});
