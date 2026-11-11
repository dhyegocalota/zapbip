import { WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from '../../src/adapters/whatsapp/whatsapp-enums';
import { CONTENT_SECURITY_POLICY } from '../../src/backoffice/backoffice-constants';
import { FakeGraph } from '../support/fake-graph';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { requestBackoffice } from './backoffice-auth-fixtures';
import { endBackofficeSession, getPage, postAction, startBackofficeSession } from './backoffice-numbers-fixtures';

const EXPECTED_CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
const NUMBER_ID = 'num_polish';
const PHONE_NUMBER_ID = '1000000000888';
const WABA_ID = '3000000000888';
const DISPLAY_NUMBER = '5511988880000';
const REPORTED_DISPLAY_NUMBER = '+55 11 98888-0000';
const SIGNED_OUT_PATH = '/sign-in';
const SIGNED_IN_PATHS = [
  '/',
  '/numbers',
  '/numbers/connect',
  `/numbers/${NUMBER_ID}`,
  `/numbers/${NUMBER_ID}/verification`,
  '/metrics',
  '/audit',
  '/nope',
];
const FORBIDDEN_MARKUP = [/<script/, /\sstyle=/, /font-src/];
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
    state: WhatsAppNumberState.Pending,
  });
  await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET verified_at = NULL WHERE id = ?').bind(NUMBER_ID).run();
  await fakeGraph.reset();
  await fakeGraph.respondWith({
    method: 'GET',
    path: `/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}`,
    status: 200,
    body: { display_phone_number: REPORTED_DISPLAY_NUMBER, verified_name: 'Logic Bit', quality_rating: 'GREEN' },
  });
  await fakeGraph.respondWith({
    method: 'GET',
    path: `/${GRAPH_API_VERSION}/${WABA_ID}/message_templates`,
    status: 200,
    body: { data: [{ name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.EnglishUs, status: 'APPROVED' }] },
  });
  await postAction({ path: `/numbers/${NUMBER_ID}/verify`, sessionToken, fields: {} });
});

afterEach(endBackofficeSession);

describe('backoffice headers and markup after the ui polish', () => {
  test('the content security policy is byte-equal to the shipped one', () => {
    expect(CONTENT_SECURITY_POLICY).toBe(EXPECTED_CONTENT_SECURITY_POLICY);
  });

  test('the signed-out page sends the policy and carries no script or inline style', async () => {
    const response = await requestBackoffice({ path: SIGNED_OUT_PATH });
    const html = await response.text();
    expect(response.headers.get('content-security-policy')).toBe(EXPECTED_CONTENT_SECURITY_POLICY);
    FORBIDDEN_MARKUP.forEach((pattern) => expect(html).not.toMatch(pattern));
  });

  test.each(SIGNED_IN_PATHS)('%s sends the policy and carries no script or inline style', async (path) => {
    const response = await getPage({ path, sessionToken });
    const html = await response.text();
    expect(response.headers.get('content-security-policy')).toBe(EXPECTED_CONTENT_SECURITY_POLICY);
    FORBIDDEN_MARKUP.forEach((pattern) => expect(html).not.toMatch(pattern));
  });
});
