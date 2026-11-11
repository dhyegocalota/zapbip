import { DISPLAY_NUMBER_PATTERN, META_APP_ID } from '@zapbip/types';
import { z } from 'zod';
import { GRAPH_NO_RESPONSE_STATUS, GraphRequestError, createGraphClient } from '../adapters/whatsapp/graph-client';
import { GRAPH_API_VERSION, GRAPH_REQUEST_TIMEOUT_MS } from '../adapters/whatsapp/whatsapp-constants';
import { WhatsAppErrorCode } from '../adapters/whatsapp/whatsapp-enums';
import { GraphErrorKind, graphErrorKindOf } from './graph-error-kind';
import { digitsOf } from './number-verification';

const EXCHANGE_PATH = '/oauth/access_token';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const MESSAGING_PRODUCT = 'whatsapp';
const PHONE_NUMBER_FIELDS = 'id,display_phone_number,verified_name';
const WEBHOOK_FIELDS = 'webhook_configuration';
const EXCHANGE_FAILURE_MESSAGE = 'Graph token exchange failed';
const MANAGEMENT_SCOPE = 'whatsapp_business_management';
const EXCHANGE_REJECTION_CODES: number[] = [WhatsAppErrorCode.InvalidParameter, WhatsAppErrorCode.AuthOAuth];

export enum OnboardingStep {
  Exchange = 'exchange',
  Inspect = 'inspect',
  Read = 'read',
  Subscribe = 'subscribe',
  Register = 'register',
  Override = 'override',
}

export class OnboardingError extends Error {
  readonly step: OnboardingStep;
  readonly kind: GraphErrorKind;

  constructor(input: { step: OnboardingStep; kind: GraphErrorKind }) {
    super(`onboarding failed at ${input.step}: ${input.kind}`);
    this.step = input.step;
    this.kind = input.kind;
  }
}

export type OnboardedNumber = { accessToken: string; displayNumber: string; verifiedName: string | null };

export type OnboardNumberInput = {
  graphBaseUrl: string;
  appSecret: string;
  webhookUrl: string;
  verifyToken: string;
  code: string;
  phoneNumberId: string;
  wabaId: string;
  pin: string;
  fetcher: typeof fetch;
};

type Graph = ReturnType<typeof createGraphClient>;

const exchangeResponseSchema = z.object({ access_token: z.string().min(1) });
const errorBodySchema = z.object({ error: z.object({ code: z.number() }) });
const phoneNumbersResponseSchema = z.object({
  data: z.array(z.object({ id: z.string(), display_phone_number: z.string(), verified_name: z.string().nullable().default(null) })),
});
const debugTokenResponseSchema = z.object({
  data: z.object({
    granular_scopes: z.array(z.object({ scope: z.string(), target_ids: z.array(z.string()).default([]) })).default([]),
  }),
});
const webhookConfigurationResponseSchema = z.object({
  webhook_configuration: z.object({ phone_number: z.string().optional() }).optional(),
});

function exchangeFailure(input: { status: number; errorCode: number | null }): GraphRequestError {
  return new GraphRequestError({
    status: input.status,
    errorCode: input.errorCode,
    errorTitle: null,
    message: EXCHANGE_FAILURE_MESSAGE,
  });
}

function errorCodeOf(input: { body: unknown }): number | null {
  const parsed = errorBodySchema.safeParse(input.body);
  return parsed.success ? parsed.data.error.code : null;
}

async function exchangeCode(input: OnboardNumberInput): Promise<string> {
  const { graphBaseUrl, appSecret, code, fetcher } = input;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(`${graphBaseUrl}/${GRAPH_API_VERSION}${EXCHANGE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': FORM_CONTENT_TYPE },
      body: new URLSearchParams({ client_id: META_APP_ID, client_secret: appSecret, code }),
      signal: controller.signal,
    }).catch(() => {
      throw exchangeFailure({ status: GRAPH_NO_RESPONSE_STATUS, errorCode: null });
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw exchangeFailure({ status: response.status, errorCode: errorCodeOf({ body }) });
    if (body === null) throw exchangeFailure({ status: GRAPH_NO_RESPONSE_STATUS, errorCode: null });
    return exchangeResponseSchema.parse(body).access_token;
  } finally {
    clearTimeout(timer);
  }
}

function kindOf(input: { step: OnboardingStep; error: GraphRequestError }): GraphErrorKind {
  const { step, error } = input;
  const isRejectedCode = step === OnboardingStep.Exchange && error.errorCode !== null && EXCHANGE_REJECTION_CODES.includes(error.errorCode);
  return isRejectedCode ? GraphErrorKind.CodeExpired : graphErrorKindOf({ error });
}

async function inStep<Value>(input: { step: OnboardingStep; run: () => Promise<Value> }): Promise<Value> {
  const { step, run } = input;
  try {
    return await run();
  } catch (error) {
    if (error instanceof GraphRequestError) throw new OnboardingError({ step, kind: kindOf({ step, error }) });
    if (error instanceof z.ZodError) throw new OnboardingError({ step, kind: GraphErrorKind.Upstream });
    throw error;
  }
}

async function readPhoneNumber(input: { graph: Graph; wabaId: string; phoneNumberId: string }) {
  const { graph, wabaId, phoneNumberId } = input;
  const listed = phoneNumbersResponseSchema.parse(await graph.get({ path: `/${wabaId}/phone_numbers?fields=${PHONE_NUMBER_FIELDS}` }));
  const phoneNumber = listed.data.find((candidate) => candidate.id === phoneNumberId);
  if (phoneNumber === undefined) throw new OnboardingError({ step: OnboardingStep.Read, kind: GraphErrorKind.NotFound });
  const displayNumber = `+${digitsOf({ value: phoneNumber.display_phone_number })}`;
  if (!DISPLAY_NUMBER_PATTERN.test(displayNumber)) throw new OnboardingError({ step: OnboardingStep.Read, kind: GraphErrorKind.Upstream });
  return { displayNumber, verifiedName: phoneNumber.verified_name };
}

async function assertWabaGranted(input: { graph: Graph; accessToken: string; wabaId: string }): Promise<void> {
  const { graph, accessToken, wabaId } = input;
  const inspected = debugTokenResponseSchema.parse(
    await graph.get({ path: `/debug_token?input_token=${encodeURIComponent(accessToken)}` }),
  );
  const isGranted = inspected.data.granular_scopes.some(
    (granted) => granted.scope === MANAGEMENT_SCOPE && granted.target_ids.includes(wabaId),
  );
  if (!isGranted) throw new OnboardingError({ step: OnboardingStep.Inspect, kind: GraphErrorKind.NotGranted });
}

async function assertWebhookUnclaimed(input: { graph: Graph; phoneNumberId: string; webhookUrl: string }): Promise<void> {
  const { graph, phoneNumberId, webhookUrl } = input;
  const current = webhookConfigurationResponseSchema.parse(await graph.get({ path: `/${phoneNumberId}?fields=${WEBHOOK_FIELDS}` }));
  const claimedUrl = current.webhook_configuration === undefined ? undefined : current.webhook_configuration.phone_number;
  if (claimedUrl === undefined) return;
  const isOwnOrigin = URL.canParse(claimedUrl) && new URL(claimedUrl).origin === new URL(webhookUrl).origin;
  if (!isOwnOrigin) throw new OnboardingError({ step: OnboardingStep.Read, kind: GraphErrorKind.WebhookClaimedElsewhere });
}

export async function onboardNumber(input: OnboardNumberInput): Promise<OnboardedNumber> {
  const { graphBaseUrl, webhookUrl, verifyToken, phoneNumberId, wabaId, pin, fetcher } = input;
  const accessToken = await inStep({ step: OnboardingStep.Exchange, run: () => exchangeCode(input) });
  const graph = createGraphClient({ baseUrl: graphBaseUrl, accessToken, developmentMediaOrigin: null, fetcher });
  const phoneNumber = await inStep({ step: OnboardingStep.Read, run: () => readPhoneNumber({ graph, wabaId, phoneNumberId }) });
  await inStep({ step: OnboardingStep.Inspect, run: () => assertWabaGranted({ graph, accessToken, wabaId }) });
  await inStep({ step: OnboardingStep.Read, run: () => assertWebhookUnclaimed({ graph, phoneNumberId, webhookUrl }) });
  await inStep({ step: OnboardingStep.Subscribe, run: () => graph.post({ path: `/${wabaId}/subscribed_apps`, body: {} }) });
  await inStep({
    step: OnboardingStep.Register,
    run: () => graph.post({ path: `/${phoneNumberId}/register`, body: { messaging_product: MESSAGING_PRODUCT, pin } }),
  });
  await inStep({
    step: OnboardingStep.Override,
    run: () =>
      graph.post({
        path: `/${phoneNumberId}`,
        body: { webhook_configuration: { override_callback_uri: webhookUrl, verify_token: verifyToken } },
      }),
  });
  return { accessToken, ...phoneNumber };
}
