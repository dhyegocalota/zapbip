import { META_APP_ID, ONBOARDING_PIN_PATTERN, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { numberAdminOf } from '../../src/adapters/d1/d1-number-admin';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { BACKOFFICE_COPY, BackofficeCopyKey, renderBackofficeCopy } from '../../src/backoffice/backoffice-copy';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { FakeGraph, fakeReportedDisplayNumberOf } from '../support/fake-graph';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { backofficeEnv } from './backoffice-auth-fixtures';
import {
  countRows,
  endBackofficeSession,
  getPage,
  numberIdOf,
  postAction,
  postForm,
  startBackofficeSession,
} from './backoffice-numbers-fixtures';

const OWN_PATH = '/numbers/connect/own';
const SELECT_PATH = '/numbers/connect/own/select';
const SYSTEM_USER_TOKEN = 'fake-system-user-token';
const FREE_WABA_ID = '3000000000000601';
const FREE_PHONE_NUMBER_ID = '1000000000000601';
const REGISTERED_WABA_ID = '3000000000000602';
const REGISTERED_PHONE_NUMBER_ID = '1000000000000602';
const OWNER_BUSINESS_ID = '3000000000000700';
const GRAPH_INVALID_REQUEST_CODE = 100;
const OWNER_LOOKUP_REFUSAL = 'Unsupported get request';
const MANAGEMENT_SCOPE = 'whatsapp_business_management';
const PIN = '482915';
const LABEL = 'Own line';
const WRONG_CODE = '000000';
const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const STATUS_UNPROCESSABLE = 422;
const STATUS_BAD_GATEWAY = 502;
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];
const configured = backofficeEnv({ overrides: { META_SYSTEM_USER_TOKEN: SYSTEM_USER_TOKEN } });
const unconfigured = backofficeEnv({});
const registry = numberRegistryOf({ bindings: testEnv });
const fakeGraph = new FakeGraph({
  baseUrl: readWhatsAppEnvironment({ env: testEnv }).graphBaseUrl,
  resourceIds: [FREE_WABA_ID, FREE_PHONE_NUMBER_ID, REGISTERED_WABA_ID, REGISTERED_PHONE_NUMBER_ID],
});

let sessionToken: string;

function submission(overrides: Record<string, string> = {}): Record<string, string> {
  return { [NumberFormField.OwnNumber]: FREE_PHONE_NUMBER_ID, [NumberFormField.Label]: LABEL, [NumberFormField.Pin]: PIN, ...overrides };
}

function respondToGet(input: { path: string; status: number; body: unknown }): Promise<void> {
  return fakeGraph.respondWith({ method: 'GET', path: `/${GRAPH_API_VERSION}${input.path}`, status: input.status, body: input.body });
}

async function tokenTargets(input: { wabaIds: string[] }): Promise<void> {
  await fakeGraph.respondWith({
    method: 'GET',
    path: `/${GRAPH_API_VERSION}/debug_token`,
    status: STATUS_OK,
    body: { data: { is_valid: true, granular_scopes: [{ scope: MANAGEMENT_SCOPE, target_ids: input.wabaIds }] } },
    scopeId: SYSTEM_USER_TOKEN,
  });
}

async function ownerBusinessHolds(input: { wabaIds: string[] }): Promise<void> {
  await respondToGet({ path: `/${META_APP_ID}`, status: STATUS_OK, body: { owner_business: { id: OWNER_BUSINESS_ID } } });
  await respondToGet({
    path: `/${OWNER_BUSINESS_ID}/owned_whatsapp_business_accounts`,
    status: STATUS_OK,
    body: { data: input.wabaIds.map((id) => ({ id })) },
  });
  await respondToGet({ path: `/${OWNER_BUSINESS_ID}/client_whatsapp_business_accounts`, status: STATUS_OK, body: { data: [] } });
}

async function ownerBusinessRefuses(): Promise<void> {
  await respondToGet({
    path: `/${META_APP_ID}`,
    status: STATUS_BAD_REQUEST,
    body: { error: { code: GRAPH_INVALID_REQUEST_CODE, message: OWNER_LOOKUP_REFUSAL } },
  });
}

function diagnosticCountsOf(input: { accounts: number; found: number; connected: number }): string {
  return renderBackofficeCopy({
    key: BackofficeCopyKey.ConnectOwnDiagnosticCounts,
    locale: OwnerLocale.PortugueseBrazil,
    values: { accounts: String(input.accounts), found: String(input.found), connected: String(input.connected) },
  });
}

async function selectionPage(): Promise<string> {
  await grant();
  return (await getPage({ path: SELECT_PATH, sessionToken, env: configured })).text();
}

function grant(): Promise<Response> {
  return postAction({ path: OWN_PATH, sessionToken, fields: {}, env: configured });
}

function followConfigured(input: { posted: Response }): Promise<Response> {
  const location = input.posted.headers.get('Location');
  if (location === null) throw new Error(`the form answered ${input.posted.status} without a Location`);
  return getPage({ path: location, sessionToken, env: configured });
}

async function grantedSubmit(overrides: Record<string, string> = {}): Promise<Response> {
  await grant();
  return postForm({ path: SELECT_PATH, sessionToken, fields: submission(overrides), env: configured });
}

async function grantUntil(): Promise<number | null> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT onboarding_grant_until AS until FROM backoffice_sessions').first<{
    until: number | null;
  }>();
  if (row === null) throw new Error('the session row is missing');
  return row.until;
}

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await fakeGraph.reset();
  await fakeGraph.grantWabas({ wabaIds: [FREE_WABA_ID, REGISTERED_WABA_ID] });
});

afterEach(() => {
  endBackofficeSession();
  vi.restoreAllMocks();
});

describe('the own business connect path', () => {
  test('shows the not configured notice instead of the form and grants nothing when the secret is absent', async () => {
    const page = await getPage({ path: OWN_PATH, sessionToken, env: unconfigured });
    expect(await page.text()).toContain(copy[BackofficeCopyKey.ConnectOwnNotConfigured]);
    const posted = await postAction({ path: OWN_PATH, sessionToken, fields: {}, env: unconfigured });
    expect(await posted.text()).toContain(copy[BackofficeCopyKey.ConnectOwnNotConfigured]);
    expect(await grantUntil()).toBeNull();
    expect(await fakeGraph.requests()).toEqual([]);
  });

  test('refuses a wrong authenticator code with the 401 flash and no grant', async () => {
    const posted = await postAction({ path: OWN_PATH, sessionToken, fields: {}, code: WRONG_CODE, env: configured });
    const followed = await followConfigured({ posted });
    expect(posted.headers.get('Location')).toBe(OWN_PATH);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.StepUpRejected]);
    expect(await grantUntil()).toBeNull();
  });

  test('a good code grants and redirects to the selection, which lists only unregistered numbers', async () => {
    await seedWhatsAppNumber({ numberId: 'num_registered', phoneNumberId: REGISTERED_PHONE_NUMBER_ID, wabaId: REGISTERED_WABA_ID });
    const posted = await grant();
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(posted.headers.get('Location')).toBe(SELECT_PATH);
    const body = await (await getPage({ path: SELECT_PATH, sessionToken, env: configured })).text();
    expect(body).toContain(`value="${FREE_PHONE_NUMBER_ID}"`);
    expect(body).toContain(fakeReportedDisplayNumberOf({ phoneNumberId: FREE_PHONE_NUMBER_ID }));
    expect(body).not.toContain(`value="${REGISTERED_PHONE_NUMBER_ID}"`);
  });

  test('lists a number of a business account that only the app owner business holds when the token names no target', async () => {
    await tokenTargets({ wabaIds: [] });
    await ownerBusinessHolds({ wabaIds: [FREE_WABA_ID] });
    const body = await selectionPage();
    expect(body).toContain(`value="${FREE_PHONE_NUMBER_ID}"`);
    expect(body).not.toContain(copy[BackofficeCopyKey.ConnectOwnNoNumbers]);
  });

  test('keeps the numbers of the granted targets when the owner business lookup fails', async () => {
    await tokenTargets({ wabaIds: [FREE_WABA_ID, REGISTERED_WABA_ID] });
    await ownerBusinessRefuses();
    const body = await selectionPage();
    expect(body).toContain(`value="${FREE_PHONE_NUMBER_ID}"`);
    expect(body).toContain(`value="${REGISTERED_PHONE_NUMBER_ID}"`);
  });

  test('explains an empty list with zero counts and the lookup failure when nothing is reachable', async () => {
    await tokenTargets({ wabaIds: [] });
    await ownerBusinessRefuses();
    const body = await selectionPage();
    expect(body).toContain(copy[BackofficeCopyKey.ConnectOwnNoNumbers]);
    expect(body).toContain(diagnosticCountsOf({ accounts: 0, found: 0, connected: 0 }));
    expect(body).toContain(
      renderBackofficeCopy({
        key: BackofficeCopyKey.ConnectOwnDiagnosticLookupFailed,
        locale: OwnerLocale.PortugueseBrazil,
        values: { reason: `HTTP ${STATUS_BAD_REQUEST} · code ${GRAPH_INVALID_REQUEST_CODE} · ${OWNER_LOOKUP_REFUSAL}` },
      }),
    );
  });

  test('counts the numbers that are already connected and hides them', async () => {
    await seedWhatsAppNumber({
      numberId: 'num_free',
      phoneNumberId: FREE_PHONE_NUMBER_ID,
      wabaId: FREE_WABA_ID,
      displayNumber: fakeReportedDisplayNumberOf({ phoneNumberId: FREE_PHONE_NUMBER_ID }),
    });
    await seedWhatsAppNumber({ numberId: 'num_registered', phoneNumberId: REGISTERED_PHONE_NUMBER_ID, wabaId: REGISTERED_WABA_ID });
    await tokenTargets({ wabaIds: [REGISTERED_WABA_ID] });
    await ownerBusinessHolds({ wabaIds: [FREE_WABA_ID] });
    const body = await selectionPage();
    expect(body).toContain(diagnosticCountsOf({ accounts: 2, found: 2, connected: 2 }));
    expect(body).not.toContain(`value="${FREE_PHONE_NUMBER_ID}"`);
    expect(body).not.toContain(`value="${REGISTERED_PHONE_NUMBER_ID}"`);
  });

  test('sends the selection page back to the step-up without a grant', async () => {
    const response = await getPage({ path: SELECT_PATH, sessionToken, env: configured });
    expect(response.headers.get('Location')).toBe(OWN_PATH);
  });

  test('subscribes, registers with a generated pin, seals the system user token and the pin, and audits the source', async () => {
    const response = await grantedSubmit({ [NumberFormField.Pin]: '' });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    const numberId = numberIdOf({ response });
    expect(response.headers.get('Location')).toBe(`/numbers/${numberId}?notice=Registered`);
    const requests = await fakeGraph.requests();
    const summary = requests.map((request) => `${request.method} ${request.path}`);
    expect(summary).toContain(`POST /${GRAPH_API_VERSION}/${FREE_WABA_ID}/subscribed_apps`);
    const registerBody = requests.find((request) => request.path.endsWith(`/${FREE_PHONE_NUMBER_ID}/register`))?.body as { pin: string };
    expect(registerBody.pin).toMatch(ONBOARDING_PIN_PATTERN);
    requests.forEach((request) => expect(request.headers.authorization).toBe(`Bearer ${SYSTEM_USER_TOKEN}`));
    const row = await testEnv.CONNECTIONS.prepare(
      'SELECT state, label, sealed_access_token AS sealedToken, sealed_two_step_pin AS sealedPin FROM whatsapp_numbers WHERE id = ?',
    )
      .bind(numberId)
      .first<{ state: string; label: string; sealedToken: string; sealedPin: string }>();
    expect(row?.state).toBe(WhatsAppNumberState.Pending);
    expect(row?.label).toBe(LABEL);
    expect(row?.sealedToken).not.toContain(SYSTEM_USER_TOKEN);
    expect(row?.sealedPin).not.toContain(registerBody.pin);
    expect((await registry.openForInbound({ numberId })).accessToken).toBe(SYSTEM_USER_TOKEN);
    expect(await numberAdminOf({ bindings: testEnv }).openTwoStepPin({ numberId })).toBe(registerBody.pin);
    const audit = await testEnv.CONNECTIONS.prepare('SELECT target_id AS targetId, outcome FROM backoffice_audit WHERE action = ?')
      .bind('number.connected_from_own_business')
      .all();
    expect(audit.results).toEqual([{ targetId: numberId, outcome: 'succeeded' }]);
  });

  test('registers with the typed pin', async () => {
    const response = await grantedSubmit();
    const requests = await fakeGraph.requests();
    const registerBody = requests.find((request) => request.path.endsWith(`/${FREE_PHONE_NUMBER_ID}/register`))?.body;
    expect(registerBody).toEqual({ messaging_product: 'whatsapp', pin: PIN });
    expect(await numberAdminOf({ bindings: testEnv }).openTwoStepPin({ numberId: numberIdOf({ response }) })).toBe(PIN);
  });

  test('stores nothing and audits the failure when Meta refuses the subscription', async () => {
    await fakeGraph.respondWith({
      method: 'POST',
      path: `/${GRAPH_API_VERSION}/${FREE_WABA_ID}/subscribed_apps`,
      status: STATUS_UNAUTHORIZED,
      body: { error: { code: 1, message: 'refused' } },
    });
    const posted = await grantedSubmit();
    const followed = await followConfigured({ posted });
    expect(posted.headers.get('Location')).toBe(OWN_PATH);
    expect(followed.status).toBe(STATUS_BAD_GATEWAY);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.OnboardingKindAuth]);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(0);
    const audit = await testEnv.CONNECTIONS.prepare('SELECT outcome FROM backoffice_audit WHERE action = ?')
      .bind('number.connected_from_own_business')
      .all();
    expect(audit.results).toEqual([{ outcome: 'failed' }]);
  });

  test('answers 502 not found for a number the business does not hold, and stores nothing', async () => {
    const posted = await grantedSubmit({ [NumberFormField.OwnNumber]: '1000000000000699' });
    const followed = await followConfigured({ posted });
    expect(followed.status).toBe(STATUS_BAD_GATEWAY);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.OnboardingKindNotFound]);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(0);
  });

  test('answers 422 without a chosen number or with a bad pin, calls Graph never and spends the grant', async () => {
    const posted = await grantedSubmit({ [NumberFormField.OwnNumber]: '', [NumberFormField.Pin]: '12345' });
    const followed = await followConfigured({ posted });
    expect(followed.status).toBe(STATUS_UNPROCESSABLE);
    const body = await followed.text();
    expect(body).toContain(copy[BackofficeCopyKey.FieldErrorRequired]);
    expect(body).toContain(copy[BackofficeCopyKey.FieldErrorPin]);
    expect(await fakeGraph.requests()).toEqual([]);
    expect(await grantUntil()).toBeNull();
  });

  test('answers 409 for a number that was registered meanwhile', async () => {
    await seedWhatsAppNumber({ numberId: 'num_registered', phoneNumberId: FREE_PHONE_NUMBER_ID, wabaId: FREE_WABA_ID });
    const posted = await grantedSubmit();
    const followed = await followConfigured({ posted });
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.FieldErrorDuplicate]);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(1);
  });
});
