import { HttpStatus, type OwnerLocale, WaitlistJoinOutcome, WaitlistSource } from '@zapbip/types';
import type { Context } from 'hono';
import { CLIENT_ADDRESS_HEADER } from '../contract/constants';
import { clientRateKey } from '../routes/client-rate-key';
import { BAD_REQUEST_TEXT, plainResponse } from '../routes/private-response';
import { AgentAnswerStatus, answerResponse, requestedLocaleOf } from './agentic-answer';
import { joinWaitlist, normalizeEmail } from './join-waitlist';
import { isWaitlistOpen } from './site-configuration';
import { AGENT_ADDRESS_WEIGHT, AGENT_EMAIL_WEIGHT, AGENT_RATE_KEY_PREFIX } from './site-constants';
import type { SiteEnv } from './site-env';

const EMAIL_FIELD = 'email';
const LANGUAGE_FIELD = 'language';
const ADDRESS_KEY_SCOPE = 'address:';
const EMAIL_KEY_SCOPE = 'email:';
const CONTENT_TYPE_HEADER = 'content-type';
const JSON_MEDIA_TYPE = 'application/json';

type RequestBody = Record<string, unknown>;

async function bodyOf(input: { context: Context<SiteEnv> }): Promise<RequestBody | null> {
  const value: unknown = await input.context.req.json().catch(() => null);
  const isRecord = typeof value === 'object' && value !== null && !Array.isArray(value);
  return isRecord ? (value as RequestBody) : null;
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
  const isAddressWithinLimit = await isWithinWeightedLimit({
    limiter: env.INSTALL_PAGE_LIMITER,
    key: `${AGENT_RATE_KEY_PREFIX}${ADDRESS_KEY_SCOPE}${clientRateKey({ address: clientAddress })}`,
    weight: AGENT_ADDRESS_WEIGHT,
  });
  if (!isAddressWithinLimit) return answer({ status: AgentAnswerStatus.RateLimited });
  if (!isWaitlistOpen({ env })) return answer({ status: AgentAnswerStatus.Paused });
  const isJson = context.req.header(CONTENT_TYPE_HEADER)?.toLowerCase().startsWith(JSON_MEDIA_TYPE) === true;
  if (!isJson) return answer({ status: AgentAnswerStatus.UnsupportedMediaType });
  const body = await bodyOf({ context });
  if (body === null) return answer({ status: AgentAnswerStatus.InvalidRequest });
  const locale = requestedLocaleOf({ context, value: body[LANGUAGE_FIELD] });
  if (locale === null) return answer({ status: AgentAnswerStatus.UnsupportedLanguage });
  const rawEmail = body[EMAIL_FIELD];
  const email = typeof rawEmail === 'string' ? normalizeEmail({ email: rawEmail }) : null;
  if (email === null) return answer({ status: AgentAnswerStatus.InvalidEmail, locale });
  const isEmailWithinLimit = await isWithinWeightedLimit({
    limiter: env.INSTALL_PAGE_LIMITER,
    key: `${AGENT_RATE_KEY_PREFIX}${EMAIL_KEY_SCOPE}${email}`,
    weight: AGENT_EMAIL_WEIGHT,
  });
  if (!isEmailWithinLimit) return answer({ status: AgentAnswerStatus.RateLimited, locale });
  const result = await joinWaitlist({
    database: env.CONNECTIONS,
    email,
    locale,
    referralCode: null,
    source: WaitlistSource.Agent,
    now: Date.now(),
  });
  if (result.outcome === WaitlistJoinOutcome.InvalidEmail) return answer({ status: AgentAnswerStatus.InvalidEmail, locale });
  if (result.outcome === WaitlistJoinOutcome.Unavailable) return answer({ status: AgentAnswerStatus.Unavailable, locale });
  return answer({ status: AgentAnswerStatus.Requested, locale });
}
