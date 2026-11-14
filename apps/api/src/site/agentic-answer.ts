import { HttpStatus, OwnerLocale, type DocsLanguage } from '@zapbip/types';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { RETRY_AFTER_HEADER } from '../routes/private-response';
import {
  AGENT_BODY_MAX_BYTES,
  AGENT_CAP_RETRY_AFTER_VALUE,
  JSON_CONTENT_TYPE,
  NO_STORE_CACHE_CONTROL,
  RETRY_AFTER_VALUE,
} from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';
import type { SiteEnv } from './site-env';
import { localeOfLanguageValue } from './site-language';
import { languageOf } from '../web-shell/locale-profiles';

const MESSAGE_SEPARATOR = ' ';
const LANGUAGE_SEPARATOR = ', ';

export enum AgentAnswerStatus {
  Requested = 'requested',
  InvalidEmail = 'invalid_email',
  UnsupportedLanguage = 'unsupported_language',
  InvalidRequest = 'invalid_request',
  UnsupportedMediaType = 'unsupported_media_type',
  PayloadTooLarge = 'payload_too_large',
  RateLimited = 'rate_limited',
  CapacityReached = 'capacity_reached',
  Paused = 'paused',
  Unavailable = 'unavailable',
  UnknownAgent = 'unknown_agent',
}

export type AgentAnswer = { status: AgentAnswerStatus; language: DocsLanguage; message: string };

type MessageOf = (input: { locale: OwnerLocale }) => string;

function copyMessage(input: { keys: SiteCopyKey[] }): MessageOf {
  return ({ locale }) => input.keys.map((key) => copyOf({ locale })(key)).join(MESSAGE_SEPARATOR);
}

function fixedMessage(input: { text: string }): MessageOf {
  return () => input.text;
}

export function supportedLanguagesText(): string {
  return Object.values(OwnerLocale)
    .map((locale) => languageOf({ locale }))
    .join(LANGUAGE_SEPARATOR);
}

const ANSWER_MESSAGES: Record<AgentAnswerStatus, MessageOf> = {
  [AgentAnswerStatus.Requested]: copyMessage({ keys: [SiteCopyKey.ThanksTitle, SiteCopyKey.ThanksBody] }),
  [AgentAnswerStatus.InvalidEmail]: copyMessage({ keys: [SiteCopyKey.JoinEmailInvalid] }),
  [AgentAnswerStatus.RateLimited]: copyMessage({ keys: [SiteCopyKey.JoinRateLimited] }),
  [AgentAnswerStatus.Paused]: copyMessage({ keys: [SiteCopyKey.JoinPausedBody] }),
  [AgentAnswerStatus.Unavailable]: copyMessage({ keys: [SiteCopyKey.JoinUnavailable] }),
  [AgentAnswerStatus.CapacityReached]: copyMessage({ keys: [SiteCopyKey.JoinUnavailable] }),
  [AgentAnswerStatus.PayloadTooLarge]: fixedMessage({ text: `The body is larger than ${AGENT_BODY_MAX_BYTES} bytes.` }),
  [AgentAnswerStatus.UnsupportedLanguage]: () => `The language is not supported. Use one of: ${supportedLanguagesText()}.`,
  [AgentAnswerStatus.InvalidRequest]: fixedMessage({
    text: 'The body must be a JSON object such as {"email": "name@example.com", "language": "en"}.',
  }),
  [AgentAnswerStatus.UnsupportedMediaType]: fixedMessage({ text: 'Send the body as application/json.' }),
  [AgentAnswerStatus.UnknownAgent]: fixedMessage({ text: 'The agent is not known. Use one of the listed agents.' }),
};

const RETRY_AFTER_VALUES: Partial<Record<AgentAnswerStatus, string>> = {
  [AgentAnswerStatus.RateLimited]: RETRY_AFTER_VALUE,
  [AgentAnswerStatus.CapacityReached]: AGENT_CAP_RETRY_AFTER_VALUE,
};

const HTTP_STATUSES: Record<AgentAnswerStatus, HttpStatus> = {
  [AgentAnswerStatus.Requested]: HttpStatus.Ok,
  [AgentAnswerStatus.InvalidEmail]: HttpStatus.UnprocessableEntity,
  [AgentAnswerStatus.UnsupportedLanguage]: HttpStatus.UnprocessableEntity,
  [AgentAnswerStatus.InvalidRequest]: HttpStatus.BadRequest,
  [AgentAnswerStatus.UnsupportedMediaType]: HttpStatus.UnsupportedMediaType,
  [AgentAnswerStatus.PayloadTooLarge]: HttpStatus.PayloadTooLarge,
  [AgentAnswerStatus.RateLimited]: HttpStatus.TooManyRequests,
  [AgentAnswerStatus.CapacityReached]: HttpStatus.TooManyRequests,
  [AgentAnswerStatus.Paused]: HttpStatus.ServiceUnavailable,
  [AgentAnswerStatus.Unavailable]: HttpStatus.ServiceUnavailable,
  [AgentAnswerStatus.UnknownAgent]: HttpStatus.NotFound,
};

export function jsonResponse(input: {
  context: Context<SiteEnv>;
  body: object;
  status: HttpStatus;
  headers?: Record<string, string>;
}): Response {
  const headers = { 'Content-Type': JSON_CONTENT_TYPE, ...input.headers };
  return input.context.body(JSON.stringify(input.body), input.status as ContentfulStatusCode, headers);
}

export function answerResponse(input: {
  context: Context<SiteEnv>;
  status: AgentAnswerStatus;
  locale: OwnerLocale;
  extra?: object;
}): Response {
  const { context, status, locale, extra } = input;
  const body: AgentAnswer = { status, language: languageOf({ locale }), message: ANSWER_MESSAGES[status]({ locale }) };
  const retryAfter = RETRY_AFTER_VALUES[status];
  const retryHeaders: Record<string, string> = retryAfter === undefined ? {} : { [RETRY_AFTER_HEADER]: retryAfter };
  return jsonResponse({
    context,
    body: { ...body, ...extra },
    status: HTTP_STATUSES[status],
    headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL, ...retryHeaders },
  });
}

export function requestedLocaleOf(input: { context: Context<SiteEnv>; value: unknown }): OwnerLocale | null {
  const { context, value } = input;
  if (value === undefined) return context.get('locale');
  if (typeof value !== 'string') return null;
  return localeOfLanguageValue({ value });
}
