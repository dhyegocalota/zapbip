import { META_APP_ID, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { ONBOARDING_GRANT_TTL_MS } from '../../src/backoffice/backoffice-constants';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { OnboardingStep } from '../../src/numbers/meta-onboarding';
import { FakeGraph } from '../support/fake-graph';
import { TEST_META_APP_SECRET } from '../support/meta-app-secret';
import { seedAccount } from '../support/seed';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import {
  countRows,
  endBackofficeSession,
  followRedirect,
  getPage,
  numberIdOf,
  postAction,
  postForm,
  refusingStepUpEnv,
  startBackofficeSession,
} from './backoffice-numbers-fixtures';

const CONNECT_PATH = '/numbers/connect';
const META_PATH = '/numbers/connect/meta';
const SIGNUP_CODE = 'signup-code-501';
const PHONE_NUMBER_ID = '1000000000000501';
const WABA_ID = '3000000000000501';
const PIN = '482915';
const LABEL = 'Main line';
const BUSINESS_TOKEN = 'fake-business-token';
const DISPLAY_NUMBER = '+5511900000501';
const WRONG_CODE = '000000';
const EVIL_ORIGIN = 'https://evil.example';
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_CONFLICT = 409;
const STATUS_UNPROCESSABLE = 422;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_BAD_GATEWAY = 502;
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];
const registry = numberRegistryOf({ bindings: testEnv });
const fakeGraph = new FakeGraph({
  baseUrl: readWhatsAppEnvironment({ env: testEnv }).graphBaseUrl,
  resourceIds: [SIGNUP_CODE, PHONE_NUMBER_ID, WABA_ID],
});

let sessionToken: string;

function metaFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    [NumberFormField.SignupCode]: SIGNUP_CODE,
    [NumberFormField.PhoneNumberId]: PHONE_NUMBER_ID,
    [NumberFormField.WabaId]: WABA_ID,
    [NumberFormField.Label]: LABEL,
    [NumberFormField.Pin]: PIN,
    ...overrides,
  };
}

async function grantOnboarding(): Promise<Response> {
  return postAction({ path: CONNECT_PATH, sessionToken, fields: {} });
}

async function grantUntil(): Promise<number | null> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT onboarding_grant_until AS until FROM backoffice_sessions').first<{
    until: number | null;
  }>();
  if (row === null) throw new Error('the session row is missing');
  return row.until;
}

async function connect(overrides: Record<string, string> = {}): Promise<Response> {
  return postForm({ path: META_PATH, sessionToken, fields: metaFields(overrides) });
}

async function grantedConnect(overrides: Record<string, string> = {}): Promise<Response> {
  await grantOnboarding();
  return connect(overrides);
}

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await fakeGraph.reset();
});

afterEach(() => {
  endBackofficeSession();
  vi.restoreAllMocks();
});

describe('the onboarding grant', () => {
  test('a good code grants ten minutes and redirects to the Meta page', async () => {
    const response = await grantOnboarding();
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe(META_PATH);
    expect(await grantUntil()).toBe(Date.now() + ONBOARDING_GRANT_TTL_MS);
  });

  test('a bad code answers the 401 flash with the copy and sets no grant', async () => {
    const posted = await postAction({ path: CONNECT_PATH, sessionToken, fields: {}, code: WRONG_CODE });
    const followed = await followRedirect({ posted, sessionToken });
    expect(posted.headers.get('Location')).toBe(CONNECT_PATH);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.StepUpRejected]);
    expect(await grantUntil()).toBeNull();
  });

  test('a refusing rate limiter answers 429 with Retry-After and sets no grant', async () => {
    const response = await postAction({ path: CONNECT_PATH, sessionToken, fields: {}, env: refusingStepUpEnv() });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await grantUntil()).toBeNull();
  });
});

describe('connecting a number', () => {
  test('stores a pending number with the sealed business token, audits it and redirects to it', async () => {
    const response = await grantedConnect();
    expect(response.status).toBe(STATUS_SEE_OTHER);
    const numberId = numberIdOf({ response });
    expect(response.headers.get('Location')).toBe(`/numbers/${numberId}?notice=Registered`);
    const row = await testEnv.CONNECTIONS.prepare('SELECT state, display_number AS displayNumber, label FROM whatsapp_numbers WHERE id = ?')
      .bind(numberId)
      .first();
    expect(row).toEqual({ state: WhatsAppNumberState.Pending, displayNumber: DISPLAY_NUMBER, label: LABEL });
    expect((await registry.openForInbound({ numberId })).accessToken).toBe(BUSINESS_TOKEN);
    const audit = await testEnv.CONNECTIONS.prepare('SELECT target_id AS targetId FROM backoffice_audit WHERE action = ?')
      .bind('number.registered')
      .all();
    expect(audit.results).toEqual([{ targetId: numberId }]);
  });

  test('sends the four Graph requests with the fixed app, the webhook override and the pin', async () => {
    await grantedConnect();
    const requests = await fakeGraph.requests();
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      `POST /${GRAPH_API_VERSION}/oauth/access_token`,
      `POST /${GRAPH_API_VERSION}/${WABA_ID}/subscribed_apps`,
      `POST /${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/register`,
      `GET /${GRAPH_API_VERSION}/${WABA_ID}/phone_numbers`,
    ]);
    expect(Object.fromEntries(new URLSearchParams(String(requests[0]?.body)))).toEqual({
      client_id: META_APP_ID,
      client_secret: TEST_META_APP_SECRET,
      code: SIGNUP_CODE,
    });
    expect(requests[1]?.body).toEqual({
      override_callback_uri: `${testEnv.PUBLIC_ORIGIN}/webhooks/whatsapp`,
      verify_token: testEnv.WHATSAPP_VERIFY_TOKEN,
    });
    expect(requests[2]?.body).toEqual({ messaging_product: 'whatsapp', pin: PIN });
  });

  test('binds the accounts without a number and says so', async () => {
    await seedAccount({ accountId: 'acc_unbound' });
    const response = await grantedConnect();
    expect(response.headers.get('Location')).toContain('notice=RegisteredWithBackfill');
  });

  test('a second post with the same fields is sent back to the step-up and calls Graph no more', async () => {
    await grantedConnect();
    const requestsBefore = (await fakeGraph.requests()).length;
    const second = await connect();
    expect(second.headers.get('Location')).toBe(CONNECT_PATH);
    expect((await followRedirect({ posted: second, sessionToken })).status).toBe(STATUS_UNAUTHORIZED);
    expect((await fakeGraph.requests()).length).toBe(requestsBefore);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(1);
  });

  test('a post without a grant is sent back to the step-up with no Graph request', async () => {
    const response = await connect();
    expect(response.headers.get('Location')).toBe(CONNECT_PATH);
    expect(await fakeGraph.requests()).toEqual([]);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(0);
  });

  test('a grant that expired a millisecond ago is as no grant', async () => {
    await grantOnboarding();
    await testEnv.CONNECTIONS.prepare('UPDATE backoffice_sessions SET onboarding_grant_until = ?')
      .bind(Date.now() - 1)
      .run();
    const response = await connect();
    expect(response.headers.get('Location')).toBe(CONNECT_PATH);
    expect(await fakeGraph.requests()).toEqual([]);
  });

  test.each<{ name: string; overrides: Record<string, string>; error: BackofficeCopyKey }>([
    { name: 'a five digit pin', overrides: { [NumberFormField.Pin]: '12345' }, error: BackofficeCopyKey.FieldErrorPin },
    { name: 'a letter pin', overrides: { [NumberFormField.Pin]: 'abcdef' }, error: BackofficeCopyKey.FieldErrorPin },
    {
      name: 'a 61 character label',
      overrides: { [NumberFormField.Label]: 'x'.repeat(61) },
      error: BackofficeCopyKey.FieldErrorLabelLength,
    },
    { name: 'a non-digit waba id', overrides: { [NumberFormField.WabaId]: '12a' }, error: BackofficeCopyKey.FieldErrorDigits },
    { name: 'a missing signup code', overrides: { [NumberFormField.SignupCode]: '' }, error: BackofficeCopyKey.FieldErrorRequired },
  ])('answers 422 with the field error for $name, calls Graph never and spends the grant', async ({ overrides, error }) => {
    const posted = await grantedConnect(overrides);
    const followed = await followRedirect({ posted, sessionToken });
    expect(posted.headers.get('Location')).toBe(CONNECT_PATH);
    expect(followed.status).toBe(STATUS_UNPROCESSABLE);
    expect(await followed.text()).toContain(copy[error]);
    expect(await fakeGraph.requests()).toEqual([]);
    expect(await grantUntil()).toBeNull();
  });

  test('answers 409 for a phone number id that is already registered, before any Graph call', async () => {
    await seedWhatsAppNumber({ numberId: 'num_existing', phoneNumberId: PHONE_NUMBER_ID, wabaId: WABA_ID });
    const posted = await grantedConnect();
    const followed = await followRedirect({ posted, sessionToken });
    expect(followed.status).toBe(STATUS_CONFLICT);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.FieldErrorDuplicate]);
    expect(await fakeGraph.requests()).toEqual([]);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(1);
  });

  test.each([OnboardingStep.Exchange, OnboardingStep.Subscribe, OnboardingStep.Register, OnboardingStep.Read])(
    'answers 502 naming the %s step and the auth kind when Meta refuses it, stores nothing and logs the step and kind only',
    async (step) => {
      const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
      const suffixes: Record<OnboardingStep, { method: string; suffix: string }> = {
        [OnboardingStep.Exchange]: { method: 'POST', suffix: '/oauth/access_token' },
        [OnboardingStep.Subscribe]: { method: 'POST', suffix: `/${WABA_ID}/subscribed_apps` },
        [OnboardingStep.Register]: { method: 'POST', suffix: `/${PHONE_NUMBER_ID}/register` },
        [OnboardingStep.Read]: { method: 'GET', suffix: `/${WABA_ID}/phone_numbers` },
      };
      await fakeGraph.respondWith({
        method: suffixes[step].method,
        path: `/${GRAPH_API_VERSION}${suffixes[step].suffix}`,
        status: STATUS_UNAUTHORIZED,
        scopeId: step === OnboardingStep.Exchange ? SIGNUP_CODE : undefined,
        body: { error: { code: 190, message: 'refused' } },
      });
      const posted = await grantedConnect();
      const followed = await followRedirect({ posted, sessionToken });
      const body = await followed.text();
      expect(posted.headers.get('Location')).toBe(CONNECT_PATH);
      expect(followed.status).toBe(STATUS_BAD_GATEWAY);
      expect(body).toContain(copy[BackofficeCopyKey.OnboardingKindAuth]);
      expect(await countRows({ table: 'whatsapp_numbers' })).toBe(0);
      const events = spies.flatMap((spy) => spy.mock.calls).map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
      expect(events).toContainEqual({ event: OperatorEvent.BackofficeOnboardingFailed, onboarding_step: step, onboarding_kind: 'auth' });
    },
  );

  test('refuses a post without Origin and a post with a wrong token, and keeps the grant', async () => {
    await grantOnboarding();
    const withoutOrigin = await postForm({ path: META_PATH, sessionToken, fields: metaFields(), origin: null });
    const foreignOrigin = await postForm({ path: META_PATH, sessionToken, fields: metaFields(), origin: EVIL_ORIGIN });
    const wrongToken = await postForm({ path: META_PATH, sessionToken, fields: metaFields(), csrf: 'wrong-token' });
    [withoutOrigin, foreignOrigin, wrongToken].forEach((response) => expect(response.status).toBe(STATUS_FORBIDDEN));
    expect(await grantUntil()).not.toBeNull();
    expect(await fakeGraph.requests()).toEqual([]);
  });

  test('the code, the pin and the token reach no log line, flash, body or Location header', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const responses: Response[] = [];
    responses.push(await grantedConnect({ [NumberFormField.Pin]: 'abcdef' }));
    responses.push(await grantedConnect());
    await grantOnboarding();
    responses.push(await connect());
    const followed = await Promise.all(responses.map((response) => followRedirect({ posted: response, sessionToken }).catch(() => null)));
    const flashRows = await testEnv.CONNECTIONS.prepare('SELECT flash FROM backoffice_sessions').all();
    const everything = JSON.stringify([
      spies.flatMap((spy) => spy.mock.calls),
      flashRows.results,
      await Promise.all(followed.flatMap((response) => (response === null ? [] : [response.text()]))),
      responses.map((response) => response.headers.get('Location')),
    ]);
    [SIGNUP_CODE, PIN, BUSINESS_TOKEN, TEST_META_APP_SECRET].forEach((secret) => expect(everything).not.toContain(secret));
  });
});

describe('the removed manual routes', () => {
  test('the register form and the app secret route answer 404', async () => {
    expect((await getPage({ path: '/numbers/new', sessionToken })).status).toBe(STATUS_NOT_FOUND);
    const posted = await postAction({ path: '/meta-apps/app_1/app-secret', sessionToken, fields: {} });
    expect(posted.status).toBe(STATUS_NOT_FOUND);
  });
});
