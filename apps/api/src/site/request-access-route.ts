import { HttpStatus, type OwnerLocale, WaitlistJoinOutcome, WaitlistSource } from '@zapbip/types';
import type { Context } from 'hono';
import { sha256Hex } from '../adapters/platform/hash';
import { CLIENT_ADDRESS_HEADER } from '../contract/constants';
import { clientRateKey } from '../routes/client-rate-key';
import { BAD_REQUEST_TEXT, plainResponse } from '../routes/private-response';
import { isAgentRowCapReached } from './agent-row-cap';
import { AgentAnswerStatus, answerResponse, requestedLocaleOf } from './agentic-answer';
import { joinWaitlist, normalizeEmail } from './join-waitlist';
import { isWaitlistOpen } from './site-configuration';
import {
  AGENT_ADDRESS_IPV6_PREFIX_GROUPS,
  AGENT_ADDRESS_WEIGHT,
  AGENT_BODY_MAX_BYTES,
  AGENT_EMAIL_WEIGHT,
  AGENT_GLOBAL_KEY,
  AGENT_GLOBAL_WEIGHT,
  AGENT_RATE_KEY_PREFIX,
} from './site-constants';
import type { SiteEnv } from './site-env';
import { scheduleWelcomeEmail } from './welcome-delivery';

const EMAIL_FIELD = 'email';
const LANGUAGE_FIELD = 'language';
const ADDRESS_KEY_SCOPE = 'address:';
const EMAIL_KEY_SCOPE = 'email:';
const CONTENT_TYPE_HEADER = 'content-type';
const CONTENT_LENGTH_HEADER = 'content-length';
const MEDIA_TYPE_SEPARATOR = ';';
const JSON_MEDIA_TYPE = 'application/json';

type RequestBody = Record<string, unknown>;
type BodyOutcome = { status: AgentAnswerStatus.PayloadTooLarge | AgentAnswerStatus.InvalidRequest } | { body: RequestBody };

function isJsonMediaType(input: { context: Context<SiteEnv> }): boolean {
  const header = input.context.req.header(CONTENT_TYPE_HEADER);
  if (header === undefined) return false;
  return header.split(MEDIA_TYPE_SEPARATOR)[0]!.trim().toLowerCase() === JSON_MEDIA_TYPE;
}

function parsedBodyOf(input: { text: string }): RequestBody | null {
  const value: unknown = (() => {
    try {
      return JSON.parse(input.text);
    } catch {
      return null;
    }
  })();
  const isRecord = typeof value === 'object' && value !== null && !Array.isArray(value);
  return isRecord ? (value as RequestBody) : null;
}

async function bodyOutcomeOf(input: { context: Context<SiteEnv> }): Promise<BodyOutcome> {
  const declaredLength = Number(input.context.req.header(CONTENT_LENGTH_HEADER));
  if (declaredLength > AGENT_BODY_MAX_BYTES) return { status: AgentAnswerStatus.PayloadTooLarge };
  const text = await input.context.req.text();
  if (new TextEncoder().encode(text).length > AGENT_BODY_MAX_BYTES) return { status: AgentAnswerStatus.PayloadTooLarge };
  const body = parsedBodyOf({ text });
  return body === null ? { status: AgentAnswerStatus.InvalidRequest } : { body };
}

async function isWithinWeightedLimit(input: { limiter: RateLimit; key: string; weight: number }): Promise<boolean> {
  const outcomes = await Promise.all(Array.from({ length: input.weight }, () => input.limiter.limit({ key: input.key })));
  return outcomes.every((outcome) => outcome.success);
}

export async function requestAccessHandler(context: Context<SiteEnv>): Promise<Response> {
  const clientAddress = context.req.header(CLIENT_ADDRESS_HEADER);
  if (clientAddress === undefined) return plainResponse({ body: BAD_REQUEST_TEXT, status: HttpStatus.BadRequest });
  const { env } = context;
  const requestLocale = context.get('locale');
  const answer = (input: { status: AgentAnswerStatus; locale?: OwnerLocale }): Response =>
    answerResponse({ context, status: input.status, locale: input.locale === undefined ? requestLocale : input.locale });
  const limiter = env.INSTALL_PAGE_LIMITER;
  const addressKey = clientRateKey({ address: clientAddress, prefixGroupCount: AGENT_ADDRESS_IPV6_PREFIX_GROUPS });
  const isAddressWithinLimit = await isWithinWeightedLimit({
    limiter,
    key: `${AGENT_RATE_KEY_PREFIX}${ADDRESS_KEY_SCOPE}${addressKey}`,
    weight: AGENT_ADDRESS_WEIGHT,
  });
  if (!isAddressWithinLimit) return answer({ status: AgentAnswerStatus.RateLimited });
  const isGlobalWithinLimit = await isWithinWeightedLimit({
    limiter,
    key: `${AGENT_RATE_KEY_PREFIX}${AGENT_GLOBAL_KEY}`,
    weight: AGENT_GLOBAL_WEIGHT,
  });
  if (!isGlobalWithinLimit) return answer({ status: AgentAnswerStatus.RateLimited });
  if (!isWaitlistOpen({ env })) return answer({ status: AgentAnswerStatus.Paused });
  if (!isJsonMediaType({ context })) return answer({ status: AgentAnswerStatus.UnsupportedMediaType });
  const outcome = await bodyOutcomeOf({ context });
  if ('status' in outcome) return answer({ status: outcome.status });
  const { body } = outcome;
  const locale = requestedLocaleOf({ context, value: body[LANGUAGE_FIELD] });
  if (locale === null) return answer({ status: AgentAnswerStatus.UnsupportedLanguage });
  const rawEmail = body[EMAIL_FIELD];
  const email = typeof rawEmail === 'string' ? normalizeEmail({ email: rawEmail }) : null;
  if (email === null) return answer({ status: AgentAnswerStatus.InvalidEmail, locale });
  const isEmailWithinLimit = await isWithinWeightedLimit({
    limiter,
    key: `${AGENT_RATE_KEY_PREFIX}${EMAIL_KEY_SCOPE}${await sha256Hex({ value: email })}`,
    weight: AGENT_EMAIL_WEIGHT,
  });
  if (!isEmailWithinLimit) return answer({ status: AgentAnswerStatus.RateLimited, locale });
  const now = Date.now();
  if (await isAgentRowCapReached({ database: env.CONNECTIONS, now })) return answer({ status: AgentAnswerStatus.CapacityReached, locale });
  const result = await joinWaitlist({ database: env.CONNECTIONS, email, locale, referralCode: null, source: WaitlistSource.Agent, now });
  if (result.outcome === WaitlistJoinOutcome.InvalidEmail) return answer({ status: AgentAnswerStatus.InvalidEmail, locale });
  if (result.outcome === WaitlistJoinOutcome.Unavailable) return answer({ status: AgentAnswerStatus.Unavailable, locale });
  scheduleWelcomeEmail({ context, email: result.email, locale, referralCode: result.referralCode });
  return answer({ status: AgentAnswerStatus.Requested, locale });
}
