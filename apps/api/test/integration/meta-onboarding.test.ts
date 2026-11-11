import { META_APP_ID } from '@zapbip/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { GraphErrorKind } from '../../src/numbers/graph-error-kind';
import { OnboardingError, OnboardingStep, onboardNumber } from '../../src/numbers/meta-onboarding';
import { FakeGraph } from '../support/fake-graph';
import { testEnv } from '../support/workers-env';

const APP_SECRET = 'onboarding-app-secret';
const WEBHOOK_URL = 'https://mcp.example/webhooks/whatsapp';
const VERIFY_TOKEN = 'onboarding-verify-token';
const PIN = '482915';
const BUSINESS_TOKEN = 'fake-business-token';
const DISPLAY_NUMBER = '+5511900000001';
const REPORTED_DISPLAY_NUMBER = '+55 11 90000-0001';
const VERIFIED_NAME = 'zapbip test';
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const { graphBaseUrl } = readWhatsAppEnvironment({ env: testEnv });

type Scenario = { code: string; phoneNumberId: string; wabaId: string };

const HAPPY: Scenario = { code: 'code-301', phoneNumberId: '1000000000000301', wabaId: '3000000000000301' };
const FAILURES: Record<OnboardingStep, { method: string; suffix: (scenario: Scenario) => string }> = {
  [OnboardingStep.Exchange]: { method: 'POST', suffix: () => '/oauth/access_token' },
  [OnboardingStep.Subscribe]: { method: 'POST', suffix: ({ wabaId }) => `/${wabaId}/subscribed_apps` },
  [OnboardingStep.Register]: { method: 'POST', suffix: ({ phoneNumberId }) => `/${phoneNumberId}/register` },
  [OnboardingStep.Read]: { method: 'GET', suffix: ({ wabaId }) => `/${wabaId}/phone_numbers` },
};
const KINDS: [number, GraphErrorKind][] = [
  [STATUS_BAD_REQUEST, GraphErrorKind.Upstream],
  [STATUS_UNAUTHORIZED, GraphErrorKind.Auth],
  [STATUS_NOT_FOUND, GraphErrorKind.NotFound],
];

function graphOf(input: { scenario: Scenario }): FakeGraph {
  const { code, phoneNumberId, wabaId } = input.scenario;
  return new FakeGraph({ baseUrl: graphBaseUrl, resourceIds: [code, phoneNumberId, wabaId] });
}

function run(input: { scenario: Scenario; fetcher?: typeof fetch }): Promise<unknown> {
  const { scenario, fetcher = fetch } = input;
  return onboardNumber({
    graphBaseUrl,
    appSecret: APP_SECRET,
    webhookUrl: WEBHOOK_URL,
    verifyToken: VERIFY_TOKEN,
    pin: PIN,
    fetcher,
    ...scenario,
  });
}

async function failureOf(input: { scenario: Scenario; fetcher?: typeof fetch }): Promise<OnboardingError> {
  const error = await run(input).then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof OnboardingError)) throw new Error('onboarding did not fail with an OnboardingError');
  return error;
}

beforeEach(async () => {
  await graphOf({ scenario: HAPPY }).reset();
});

describe('onboarding a number through Meta', () => {
  it('runs the exchange, the subscribe, the register and the read in order and returns the business token and the display number', async () => {
    const result = await run({ scenario: HAPPY });
    const requests = await graphOf({ scenario: HAPPY }).requests();
    expect(result).toEqual({ accessToken: BUSINESS_TOKEN, displayNumber: DISPLAY_NUMBER, verifiedName: VERIFIED_NAME });
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      `POST /${GRAPH_API_VERSION}/oauth/access_token`,
      `POST /${GRAPH_API_VERSION}/${HAPPY.wabaId}/subscribed_apps`,
      `POST /${GRAPH_API_VERSION}/${HAPPY.phoneNumberId}/register`,
      `GET /${GRAPH_API_VERSION}/${HAPPY.wabaId}/phone_numbers`,
    ]);
  });

  it('exchanges the code with a form post, the app id and the secret, and no authorization header', async () => {
    await run({ scenario: HAPPY });
    const [exchange] = await graphOf({ scenario: HAPPY }).requests();
    expect(exchange?.headers['content-type']).toContain('application/x-www-form-urlencoded');
    expect(exchange?.headers.authorization).toBeUndefined();
    expect(Object.fromEntries(new URLSearchParams(String(exchange?.body)))).toEqual({
      client_id: META_APP_ID,
      client_secret: APP_SECRET,
      code: HAPPY.code,
    });
  });

  it('subscribes with the webhook override and registers with the pin, both with the business token', async () => {
    await run({ scenario: HAPPY });
    const [, subscribe, register, read] = await graphOf({ scenario: HAPPY }).requests();
    expect(subscribe?.body).toEqual({ override_callback_uri: WEBHOOK_URL, verify_token: VERIFY_TOKEN });
    expect(register?.body).toEqual({ messaging_product: 'whatsapp', pin: PIN });
    [subscribe, register, read].forEach((request) => expect(request?.headers.authorization).toBe(`Bearer ${BUSINESS_TOKEN}`));
  });

  it.each(Object.values(OnboardingStep).flatMap((step) => KINDS.map(([status, kind]) => ({ step, status, kind }))))(
    'fails at $step with $kind on a $status, and the message holds no code, secret, pin or token',
    async ({ step, status, kind }) => {
      const scenario: Scenario = { code: `code-${step}-${status}`, phoneNumberId: `10000000003${status}`, wabaId: `30000000003${status}` };
      await graphOf({ scenario }).respondWith({
        method: FAILURES[step].method,
        path: `/${GRAPH_API_VERSION}${FAILURES[step].suffix(scenario)}`,
        status,
        body: { error: { code: 100, message: `${scenario.code} ${APP_SECRET} ${BUSINESS_TOKEN} ${PIN}` } },
      });
      const error = await failureOf({ scenario });
      expect([error.step, error.kind]).toEqual([step, kind]);
      [scenario.code, APP_SECRET, BUSINESS_TOKEN, PIN].forEach((secret) => expect(error.message).not.toContain(secret));
    },
  );

  it('fails with the network kind when the connection drops', async () => {
    const scenario: Scenario = { code: 'code-drop', phoneNumberId: '1000000000000302', wabaId: '3000000000000302' };
    const droppingFetcher: typeof fetch = () => Promise.reject(new Error('socket closed'));
    const error = await failureOf({ scenario, fetcher: droppingFetcher });
    expect([error.step, error.kind]).toEqual([OnboardingStep.Exchange, GraphErrorKind.Network]);
  });

  it('fails at read with not_found when the phone number is not in the WABA list', async () => {
    const scenario: Scenario = { code: 'code-absent', phoneNumberId: '1000000000000303', wabaId: '3000000000000303' };
    await graphOf({ scenario }).respondWith({
      method: 'GET',
      path: `/${GRAPH_API_VERSION}/${scenario.wabaId}/phone_numbers`,
      status: 200,
      body: { data: [{ id: '1000000000000999', display_phone_number: REPORTED_DISPLAY_NUMBER, verified_name: VERIFIED_NAME }] },
    });
    const error = await failureOf({ scenario });
    expect([error.step, error.kind]).toEqual([OnboardingStep.Read, GraphErrorKind.NotFound]);
  });

  it('fails at read with upstream when the reported display number is not a number', async () => {
    const scenario: Scenario = { code: 'code-garbled', phoneNumberId: '1000000000000304', wabaId: '3000000000000304' };
    await graphOf({ scenario }).respondWith({
      method: 'GET',
      path: `/${GRAPH_API_VERSION}/${scenario.wabaId}/phone_numbers`,
      status: 200,
      body: { data: [{ id: scenario.phoneNumberId, display_phone_number: 'abc', verified_name: VERIFIED_NAME }] },
    });
    const error = await failureOf({ scenario });
    expect([error.step, error.kind]).toEqual([OnboardingStep.Read, GraphErrorKind.Upstream]);
  });
});
