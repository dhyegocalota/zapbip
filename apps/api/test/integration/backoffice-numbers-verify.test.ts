import { OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from '../../src/adapters/whatsapp/whatsapp-enums';
import { FakeGraph } from '../support/fake-graph';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { backofficeEnv } from './backoffice-auth-fixtures';
import { endBackofficeSession, getPage, postAction, startBackofficeSession } from './backoffice-numbers-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_NOT_FOUND = 404;
const NUMBER_ID = 'num_verify';
const PHONE_NUMBER_ID = '1000000000777';
const WABA_ID = '3000000000777';
const DISPLAY_NUMBER = '5511977770000';
const REPORTED_DISPLAY_NUMBER = '+55 11 97777-0000';
const OTHER_REPORTED_DISPLAY_NUMBER = '+55 11 90000-1111';
const ACCESS_TOKEN = 'verify-access-token-ta';
const VERIFIED_NAME = 'Logic Bit';
const QUALITY_RATING = 'GREEN';
const CLOSED_PORT_BASE_URL = 'http://127.0.0.1:1';
const NUMBER_PATH = `/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}`;
const TEMPLATES_PATH = `/${GRAPH_API_VERSION}/${WABA_ID}/message_templates`;
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];
const fakeGraph = new FakeGraph({
  baseUrl: readWhatsAppEnvironment({ env: testEnv }).graphBaseUrl,
  resourceIds: [PHONE_NUMBER_ID, WABA_ID],
});

let sessionToken: string;

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await seedWhatsAppNumber({
    numberId: NUMBER_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    wabaId: WABA_ID,
    displayNumber: DISPLAY_NUMBER,
    accessToken: ACCESS_TOKEN,
    state: WhatsAppNumberState.Pending,
  });
  await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET verified_at = NULL WHERE id = ?').bind(NUMBER_ID).run();
  await fakeGraph.reset();
});

afterEach(async () => {
  endBackofficeSession();
  await fakeGraph.reset();
});

function answerNumber(input: { reportedDisplayNumber: string }): Promise<void> {
  return fakeGraph.respondWith({
    method: 'GET',
    path: NUMBER_PATH,
    status: 200,
    body: { display_phone_number: input.reportedDisplayNumber, verified_name: VERIFIED_NAME, quality_rating: QUALITY_RATING },
  });
}

function answerTemplates(): Promise<void> {
  return fakeGraph.respondWith({
    method: 'GET',
    path: TEMPLATES_PATH,
    status: 200,
    body: {
      data: [
        { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.PortugueseBrazil, status: 'APPROVED' },
        { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.EnglishUs, status: 'PENDING' },
        { name: WhatsAppTemplateName.AgentQuestion, language: WhatsAppLanguageCode.PortugueseBrazil, status: 'REJECTED' },
      ],
    },
  });
}

function answerNumberWith(input: { status: number }): Promise<void> {
  return fakeGraph.respondWith({
    method: 'GET',
    path: NUMBER_PATH,
    status: input.status,
    body: { error: { code: 100, message: 'refused' } },
  });
}

function verify(input: { env?: ReturnType<typeof backofficeEnv> }): Promise<Response> {
  return postAction({ path: `/numbers/${NUMBER_ID}/verify`, sessionToken, fields: {}, env: input.env });
}

async function verificationBody(): Promise<string> {
  const response = await getPage({ path: `/numbers/${NUMBER_ID}/verification`, sessionToken });
  expect(response.status).toBe(STATUS_OK);
  return response.text();
}

async function verifiedAt(): Promise<number | null> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT verified_at AS verifiedAt FROM whatsapp_numbers WHERE id = ?')
    .bind(NUMBER_ID)
    .first<{ verifiedAt: number | null }>();
  if (row === null) throw new Error('number row is missing');
  return row.verifiedAt;
}

describe('verifying a number with Meta', () => {
  test('the preference switches on the result page return to it', async () => {
    await answerNumber({ reportedDisplayNumber: REPORTED_DISPLAY_NUMBER });
    await answerTemplates();
    await verify({});
    const path = `/numbers/${NUMBER_ID}/verification`;
    const body = await verificationBody();
    expect(body.split(`name="returnTo" value="${path}"`)).toHaveLength(3);
  });

  test('redirects to the stored result, sets verified_at and shows the four template rows', async () => {
    await answerNumber({ reportedDisplayNumber: REPORTED_DISPLAY_NUMBER });
    await answerTemplates();
    const response = await verify({});
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/numbers/${NUMBER_ID}/verification`);
    expect(await verifiedAt()).not.toBeNull();
    const body = await verificationBody();
    expect(body).toContain(copy[BackofficeCopyKey.VerifyOk]);
    expect(body).toContain(VERIFIED_NAME);
    expect(body).toContain(QUALITY_RATING);
    expect(body.match(/class="template-row"/g)).toHaveLength(4);
    expect(body).toContain(copy[BackofficeCopyKey.VerifyTemplateStatusApproved]);
    expect(body).toContain(copy[BackofficeCopyKey.VerifyTemplateStatusPending]);
    expect(body).toContain(copy[BackofficeCopyKey.VerifyTemplateStatusRejected]);
    expect(body).toContain(copy[BackofficeCopyKey.VerifyTemplateStatusMissing]);
    expect(body).toContain(copy[BackofficeCopyKey.VerifyTemplatesWarning]);
  });

  test('calls Meta with the token of the number and keeps the token out of the stored result', async () => {
    await answerNumber({ reportedDisplayNumber: REPORTED_DISPLAY_NUMBER });
    await answerTemplates();
    await verify({});
    const requests = await fakeGraph.requests();
    expect(requests.map((request) => request.headers.authorization)).toEqual([`Bearer ${ACCESS_TOKEN}`, `Bearer ${ACCESS_TOKEN}`]);
    const row = await testEnv.CONNECTIONS.prepare('SELECT verification_snapshot AS snapshot FROM whatsapp_numbers WHERE id = ?')
      .bind(NUMBER_ID)
      .first<{ snapshot: string }>();
    expect(row?.snapshot).not.toContain(ACCESS_TOKEN);
  });

  test('a reload of the result answers 200 with the same body and makes no request to Meta', async () => {
    await answerNumber({ reportedDisplayNumber: REPORTED_DISPLAY_NUMBER });
    await answerTemplates();
    await verify({});
    const first = await verificationBody();
    const requestsBefore = (await fakeGraph.requests()).length;
    const second = await verificationBody();
    expect(second).toBe(first);
    expect((await fakeGraph.requests()).length).toBe(requestsBefore);
  });

  test('a display number that differs shows the mismatch copy and leaves verified_at null', async () => {
    await answerNumber({ reportedDisplayNumber: OTHER_REPORTED_DISPLAY_NUMBER });
    await answerTemplates();
    const response = await verify({});
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(await verifiedAt()).toBeNull();
    const body = await verificationBody();
    expect(body).toContain(copy[BackofficeCopyKey.VerifyMismatch]);
    expect(body).toContain('551190000111');
  });

  test.each([
    { status: 401, key: BackofficeCopyKey.VerifyErrorAuth },
    { status: 403, key: BackofficeCopyKey.VerifyErrorAuth },
    { status: 404, key: BackofficeCopyKey.VerifyErrorNotFound },
    { status: 500, key: BackofficeCopyKey.VerifyErrorUpstream },
  ])('a Meta $status shows the error kind copy and never the response body', async ({ status, key }) => {
    await answerNumberWith({ status });
    await verify({});
    const body = await verificationBody();
    expect(body).toContain(copy[key]);
    expect(body).not.toContain('refused');
    expect(await verifiedAt()).toBeNull();
  });

  test('a closed port shows the network error kind', async () => {
    await verify({ env: backofficeEnv({ overrides: { WHATSAPP_GRAPH_BASE_URL: CLOSED_PORT_BASE_URL } }) });
    expect(await verificationBody()).toContain(copy[BackofficeCopyKey.VerifyErrorNetwork]);
  });

  test('audits number.verified as succeeded on a match and as failed on a mismatch', async () => {
    await answerNumber({ reportedDisplayNumber: REPORTED_DISPLAY_NUMBER });
    await answerTemplates();
    await verify({});
    await answerNumber({ reportedDisplayNumber: OTHER_REPORTED_DISPLAY_NUMBER });
    await answerTemplates();
    await verify({});
    const rows = await testEnv.CONNECTIONS.prepare('SELECT outcome FROM backoffice_audit WHERE action = ? ORDER BY at, rowid')
      .bind('number.verified')
      .all<{ outcome: string }>();
    expect(rows.results.map((row) => row.outcome)).toEqual(['succeeded', 'failed']);
  });

  test('answers 404 for the result of a number that was never verified', async () => {
    const response = await getPage({ path: `/numbers/${NUMBER_ID}/verification`, sessionToken });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });
});
