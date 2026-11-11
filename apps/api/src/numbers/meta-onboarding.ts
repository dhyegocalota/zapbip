import { DISPLAY_NUMBER_PATTERN, META_APP_ID } from '@zapbip/types';
import { z } from 'zod';
import { GRAPH_NO_RESPONSE_STATUS, GraphRequestError, createGraphClient } from '../adapters/whatsapp/graph-client';
import { GRAPH_API_VERSION, GRAPH_REQUEST_TIMEOUT_MS } from '../adapters/whatsapp/whatsapp-constants';
import { GraphErrorKind, graphErrorKindOf } from './graph-error-kind';
import { digitsOf } from './number-verification';

const EXCHANGE_PATH = '/oauth/access_token';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const MESSAGING_PRODUCT = 'whatsapp';
const PHONE_NUMBER_FIELDS = 'id,display_phone_number,verified_name';
const EXCHANGE_FAILURE_MESSAGE = 'Graph token exchange failed';

export enum OnboardingStep {
  Exchange = 'exchange',
  Subscribe = 'subscribe',
  Register = 'register',
  Read = 'read',
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

const exchangeResponseSchema = z.object({ access_token: z.string().min(1) });
const phoneNumbersResponseSchema = z.object({
  data: z.array(z.object({ id: z.string(), display_phone_number: z.string(), verified_name: z.string().nullable().default(null) })),
});

function exchangeFailure(input: { status: number }): GraphRequestError {
  return new GraphRequestError({ status: input.status, errorCode: null, errorTitle: null, message: EXCHANGE_FAILURE_MESSAGE });
}

async function exchangeCode(input: OnboardNumberInput): Promise<string> {
  const { graphBaseUrl, appSecret, code, fetcher } = input;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_REQUEST_TIMEOUT_MS);
  const response = await fetcher(`${graphBaseUrl}/${GRAPH_API_VERSION}${EXCHANGE_PATH}`, {
    method: 'POST',
    headers: { 'content-type': FORM_CONTENT_TYPE },
    body: new URLSearchParams({ client_id: META_APP_ID, client_secret: appSecret, code }),
    signal: controller.signal,
  })
    .catch(() => {
      throw exchangeFailure({ status: GRAPH_NO_RESPONSE_STATUS });
    })
    .finally(() => clearTimeout(timer));
  if (!response.ok) throw exchangeFailure({ status: response.status });
  const body = await response.json().catch(() => {
    throw exchangeFailure({ status: GRAPH_NO_RESPONSE_STATUS });
  });
  return exchangeResponseSchema.parse(body).access_token;
}

async function inStep<Value>(input: { step: OnboardingStep; run: () => Promise<Value> }): Promise<Value> {
  const { step, run } = input;
  try {
    return await run();
  } catch (error) {
    if (error instanceof GraphRequestError) throw new OnboardingError({ step, kind: graphErrorKindOf({ error }) });
    if (error instanceof z.ZodError) throw new OnboardingError({ step, kind: GraphErrorKind.Upstream });
    throw error;
  }
}

async function readPhoneNumber(input: { graph: ReturnType<typeof createGraphClient>; wabaId: string; phoneNumberId: string }) {
  const { graph, wabaId, phoneNumberId } = input;
  const listed = phoneNumbersResponseSchema.parse(await graph.get({ path: `/${wabaId}/phone_numbers?fields=${PHONE_NUMBER_FIELDS}` }));
  const phoneNumber = listed.data.find((candidate) => candidate.id === phoneNumberId);
  if (phoneNumber === undefined) throw new OnboardingError({ step: OnboardingStep.Read, kind: GraphErrorKind.NotFound });
  const displayNumber = `+${digitsOf({ value: phoneNumber.display_phone_number })}`;
  if (!DISPLAY_NUMBER_PATTERN.test(displayNumber)) throw new OnboardingError({ step: OnboardingStep.Read, kind: GraphErrorKind.Upstream });
  return { displayNumber, verifiedName: phoneNumber.verified_name };
}

export async function onboardNumber(input: OnboardNumberInput): Promise<OnboardedNumber> {
  const { graphBaseUrl, webhookUrl, verifyToken, phoneNumberId, wabaId, pin, fetcher } = input;
  const accessToken = await inStep({ step: OnboardingStep.Exchange, run: () => exchangeCode(input) });
  const graph = createGraphClient({ baseUrl: graphBaseUrl, accessToken, developmentMediaOrigin: null, fetcher });
  await inStep({
    step: OnboardingStep.Subscribe,
    run: () => graph.post({ path: `/${wabaId}/subscribed_apps`, body: { override_callback_uri: webhookUrl, verify_token: verifyToken } }),
  });
  await inStep({
    step: OnboardingStep.Register,
    run: () => graph.post({ path: `/${phoneNumberId}/register`, body: { messaging_product: MESSAGING_PRODUCT, pin } }),
  });
  const phoneNumber = await inStep({ step: OnboardingStep.Read, run: () => readPhoneNumber({ graph, wabaId, phoneNumberId }) });
  return { accessToken, ...phoneNumber };
}
