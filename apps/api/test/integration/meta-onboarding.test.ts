import { META_APP_ID } from '@zapbip/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { GRAPH_API_VERSION, GRAPH_REQUEST_TIMEOUT_MS } from '../../src/adapters/whatsapp/whatsapp-constants';
import { GraphErrorKind } from '../../src/numbers/graph-error-kind';
import { OnboardingError, OnboardingStep, onboardNumber } from '../../src/numbers/meta-onboarding';
import { FAKE_UNGRANTED_WABA_PREFIX, FakeGraph } from '../support/fake-graph';
import { testEnv } from '../support/workers-env';

const APP_SECRET = 'onboarding-app-secret';
const WEBHOOK_URL = 'https://mcp.example/webhooks/whatsapp';
const VERIFY_TOKEN = 'onboarding-verify-token';
const PIN = '482915';
const BUSINESS_TOKEN = 'fake-business-token';
const DISPLAY_NUMBER = '+5511900000301';
const REPORTED_DISPLAY_NUMBER = '+55 11 90000-0001';
const VERIFIED_NAME = 'zapbip test';
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const { graphBaseUrl } = readWhatsAppEnvironment({ env: testEnv });

type Scenario = { code: string; phoneNumberId: string; wabaId: string };

const HAPPY: Scenario = { code: 'code-301', phoneNumberId: '1000000000000301', wabaId: '3000000000000301' };
const FAILURES: Record<OnboardingStep, { method: string; suffix: (scenario: Scenario) => string } | null> = {
  [OnboardingStep.Exchange]: { method: 'POST', suffix: () => '/oauth/access_token' },
  [OnboardingStep.Inspect]: null,
  [OnboardingStep.Read]: { method: 'GET', suffix: ({ wabaId }) => `/${wabaId}/phone_numbers` },
  [OnboardingStep.Subscribe]: { method: 'POST', suffix: ({ wabaId }) => `/${wabaId}/subscribed_apps` },
  [OnboardingStep.Register]: { method: 'POST', suffix: ({ phoneNumberId }) => `/${phoneNumberId}/register` },
  [OnboardingStep.Override]: { method: 'POST', suffix: ({ phoneNumberId }) => `/${phoneNumberId}` },
};
const KINDS: [number, GraphErrorKind][] = [
  [STATUS_BAD_REQUEST, GraphErrorKind.Upstream],
  [STATUS_UNAUTHORIZED, GraphErrorKind.Auth],
  [STATUS_NOT_FOUND, GraphErrorKind.NotFound],
];
const GENERIC_ERROR_CODE = 1;
const DEFAULT_WABA_PREFIX = '3';
const FIRST_SCENARIO_NUMBER = 400;
let scenarioCount = 0;
const CODE_ERRORS: { name: string; step: OnboardingStep; status: number; errorCode: number; kind: GraphErrorKind }[] = [
  {
    name: 'an invalid code (100)',
    step: OnboardingStep.Exchange,
    status: STATUS_BAD_REQUEST,
    errorCode: 100,
    kind: GraphErrorKind.CodeExpired,
  },
  {
    name: 'an expired code (190)',
    step: OnboardingStep.Exchange,
    status: STATUS_UNAUTHORIZED,
    errorCode: 190,
    kind: GraphErrorKind.CodeExpired,
  },
  {
    name: 'a pin mismatch (133005)',
    step: OnboardingStep.Register,
    status: STATUS_BAD_REQUEST,
    errorCode: 133005,
    kind: GraphErrorKind.PinMismatch,
  },
  {
    name: 'a register rate limit (133016)',
    step: OnboardingStep.Register,
    status: STATUS_BAD_REQUEST,
    errorCode: 133016,
    kind: GraphErrorKind.RateLimited,
  },
  {
    name: 'an app throttle (4)',
    step: OnboardingStep.Subscribe,
    status: STATUS_BAD_REQUEST,
    errorCode: 4,
    kind: GraphErrorKind.RateLimited,
  },
  {
    name: 'a business throttle (80007)',
    step: OnboardingStep.Read,
    status: STATUS_BAD_REQUEST,
    errorCode: 80007,
    kind: GraphErrorKind.RateLimited,
  },
  {
    name: 'a throughput throttle (130429)',
    step: OnboardingStep.Override,
    status: STATUS_BAD_REQUEST,
    errorCode: 130429,
    kind: GraphErrorKind.RateLimited,
  },
];
const OWN_WEBHOOK_ORIGIN = new URL(WEBHOOK_URL).origin;

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

function changesOf(input: { requests: Awaited<ReturnType<FakeGraph['requests']>> }): string[] {
  return input.requests.filter((request) => request.method === 'POST').map((request) => request.path.replace(`/${GRAPH_API_VERSION}`, ''));
}

function scenarioOf(input: { name: string; wabaPrefix?: string }): Scenario {
  const { wabaPrefix = DEFAULT_WABA_PREFIX } = input;
  scenarioCount += 1;
  const suffix = String(scenarioCount + FIRST_SCENARIO_NUMBER).padStart(3, '0');
  return { code: `code-${input.name}`, phoneNumberId: `10000000000${suffix}`, wabaId: `${wabaPrefix}0000000000${suffix}` };
}

describe('onboarding a number through Meta', () => {
  it('reads the list, checks the number and the webhook, subscribes, registers and sets the number override, in order', async () => {
    const result = await run({ scenario: HAPPY });
    const requests = await graphOf({ scenario: HAPPY }).requests();
    expect(result).toEqual({ accessToken: BUSINESS_TOKEN, displayNumber: DISPLAY_NUMBER, verifiedName: VERIFIED_NAME });
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      `POST /${GRAPH_API_VERSION}/oauth/access_token`,
      `GET /${GRAPH_API_VERSION}/${HAPPY.wabaId}/phone_numbers`,
      `GET /${GRAPH_API_VERSION}/${HAPPY.phoneNumberId}`,
      `POST /${GRAPH_API_VERSION}/${HAPPY.wabaId}/subscribed_apps`,
      `POST /${GRAPH_API_VERSION}/${HAPPY.phoneNumberId}/register`,
      `POST /${GRAPH_API_VERSION}/${HAPPY.phoneNumberId}`,
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

  it('subscribes the WABA with no override, registers with the pin and overrides the webhook of the number only', async () => {
    await run({ scenario: HAPPY });
    const requests = await graphOf({ scenario: HAPPY }).requests();
    const [subscribe, register, override] = requests.slice(3);
    expect(subscribe?.body).toEqual({});
    expect(register?.body).toEqual({ messaging_product: 'whatsapp', pin: PIN });
    expect(override?.body).toEqual({ webhook_configuration: { override_callback_uri: WEBHOOK_URL, verify_token: VERIFY_TOKEN } });
    requests.slice(1).forEach((request) => expect(request.headers.authorization).toBe(`Bearer ${BUSINESS_TOKEN}`));
  });

  it.each(Object.values(OnboardingStep).flatMap((step) => KINDS.map(([status, kind]) => ({ step, status, kind }))))(
    'fails at $step with $kind on a $status, and the message holds no code, secret, pin or token',
    async ({ step, status, kind }) => {
      const failure = FAILURES[step];
      if (failure === null) return;
      const scenario: Scenario = { code: `code-${step}-${status}`, phoneNumberId: `10000000003${status}`, wabaId: `30000000003${status}` };
      await graphOf({ scenario }).respondWith({
        method: failure.method,
        path: `/${GRAPH_API_VERSION}${failure.suffix(scenario)}`,
        status,
        scopeId: step === OnboardingStep.Exchange ? scenario.code : undefined,
        body: { error: { code: GENERIC_ERROR_CODE, message: `${scenario.code} ${APP_SECRET} ${BUSINESS_TOKEN} ${PIN}` } },
      });
      const error = await failureOf({ scenario });
      expect([error.step, error.kind]).toEqual([step, kind]);
      [scenario.code, APP_SECRET, BUSINESS_TOKEN, PIN].forEach((secret) => expect(error.message).not.toContain(secret));
    },
  );

  it.each(CODE_ERRORS)('fails with the kind of the Graph error code for $name', async ({ name, step, status, errorCode, kind }) => {
    const failure = FAILURES[step];
    if (failure === null) throw new Error('the step has no failing call');
    const scenario = scenarioOf({ name });
    await graphOf({ scenario }).respondWith({
      method: failure.method,
      path: `/${GRAPH_API_VERSION}${failure.suffix(scenario)}`,
      status,
      scopeId: step === OnboardingStep.Exchange ? scenario.code : undefined,
      body: { error: { code: errorCode, message: 'refused' } },
    });
    const error = await failureOf({ scenario });
    expect([error.step, error.kind]).toEqual([step, kind]);
  });

  it('fails with the network kind when the connection drops', async () => {
    const scenario: Scenario = { code: 'code-drop', phoneNumberId: '1000000000000302', wabaId: '3000000000000302' };
    const droppingFetcher: typeof fetch = () => Promise.reject(new Error('socket closed'));
    const error = await failureOf({ scenario, fetcher: droppingFetcher });
    expect([error.step, error.kind]).toEqual([OnboardingStep.Exchange, GraphErrorKind.Network]);
  });

  it('fails with the network kind when the exchange body stalls past the timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const scenario: Scenario = { code: 'code-stall', phoneNumberId: '1000000000000305', wabaId: '3000000000000305' };
    const stallingFetcher: typeof fetch = (_input, init) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
            },
          }),
        ),
      );
    const failing = failureOf({ scenario, fetcher: stallingFetcher });
    await vi.advanceTimersByTimeAsync(GRAPH_REQUEST_TIMEOUT_MS);
    const error = await failing;
    vi.useRealTimers();
    expect([error.step, error.kind]).toEqual([OnboardingStep.Exchange, GraphErrorKind.Network]);
  });

  it('refuses a phone number that is not in the WABA list before any change at Meta', async () => {
    const scenario: Scenario = { code: 'code-absent', phoneNumberId: '1000000000000303', wabaId: '3000000000000303' };
    await graphOf({ scenario }).respondWith({
      method: 'GET',
      path: `/${GRAPH_API_VERSION}/${scenario.wabaId}/phone_numbers`,
      status: 200,
      body: { data: [{ id: '1000000000000999', display_phone_number: REPORTED_DISPLAY_NUMBER, verified_name: VERIFIED_NAME }] },
    });
    const error = await failureOf({ scenario });
    expect([error.step, error.kind]).toEqual([OnboardingStep.Read, GraphErrorKind.NotFound]);
    expect(changesOf({ requests: await graphOf({ scenario }).requests() })).toEqual([`/oauth/access_token`]);
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

  it('refuses a WABA the token was not granted, before any change at Meta', async () => {
    const scenario = scenarioOf({ name: 'ungranted', wabaPrefix: FAKE_UNGRANTED_WABA_PREFIX });
    const error = await failureOf({ scenario });
    expect([error.step, error.kind]).toEqual([OnboardingStep.Inspect, GraphErrorKind.NotGranted]);
    expect(changesOf({ requests: await graphOf({ scenario }).requests() })).toEqual([`/oauth/access_token`]);
  });

  it('refuses a number whose webhook already points to another origin, and changes nothing at Meta', async () => {
    const scenario = scenarioOf({ name: 'claimed' });
    await graphOf({ scenario }).respondWith({
      method: 'GET',
      path: `/${GRAPH_API_VERSION}/${scenario.phoneNumberId}`,
      status: 200,
      body: {
        id: scenario.phoneNumberId,
        webhook_configuration: { application: 'https://app.example/hook', phone_number: 'https://production.example/webhooks/whatsapp' },
      },
    });
    const error = await failureOf({ scenario });
    expect([error.step, error.kind]).toEqual([OnboardingStep.Read, GraphErrorKind.WebhookClaimedElsewhere]);
    expect(changesOf({ requests: await graphOf({ scenario }).requests() })).toEqual([`/oauth/access_token`]);
  });

  it('goes on when the number override already points to this origin', async () => {
    const scenario = scenarioOf({ name: 'own-origin' });
    await graphOf({ scenario }).respondWith({
      method: 'GET',
      path: `/${GRAPH_API_VERSION}/${scenario.phoneNumberId}`,
      status: 200,
      body: { id: scenario.phoneNumberId, webhook_configuration: { phone_number: `${OWN_WEBHOOK_ORIGIN}/webhooks/whatsapp` } },
    });
    await expect(run({ scenario })).resolves.toMatchObject({ accessToken: BUSINESS_TOKEN });
  });
});
