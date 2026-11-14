import { HttpStatus, type WebLanguageTag, OwnerLocale } from '@zapbip/types';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { JSON_CONTENT_TYPE, NO_STORE_CACHE_CONTROL } from './site-constants';
import type { SiteEnv } from './site-env';
import { localeOfLanguageValue } from './site-language';
import { languageOf } from '../web-shell/locale-profiles';

const LANGUAGE_SEPARATOR = ', ';

export enum AgentAnswerStatus {
  UnsupportedLanguage = 'unsupported_language',
  UnknownAgent = 'unknown_agent',
}

export type AgentAnswer = { status: AgentAnswerStatus; language: WebLanguageTag; message: string };

type MessageOf = (input: { locale: OwnerLocale }) => string;

function fixedMessage(input: { text: string }): MessageOf {
  return () => input.text;
}

export function supportedLanguagesText(): string {
  return Object.values(OwnerLocale)
    .map((locale) => languageOf({ locale }))
    .join(LANGUAGE_SEPARATOR);
}

const ANSWER_MESSAGES: Record<AgentAnswerStatus, MessageOf> = {
  [AgentAnswerStatus.UnsupportedLanguage]: () => `The language is not supported. Use one of: ${supportedLanguagesText()}.`,
  [AgentAnswerStatus.UnknownAgent]: fixedMessage({ text: 'The agent is not known. Use one of the listed agents.' }),
};

const HTTP_STATUSES: Record<AgentAnswerStatus, HttpStatus> = {
  [AgentAnswerStatus.UnsupportedLanguage]: HttpStatus.UnprocessableEntity,
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
  return jsonResponse({
    context,
    body: { ...body, ...extra },
    status: HTTP_STATUSES[status],
    headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL },
  });
}

export function requestedLocaleOf(input: { context: Context<SiteEnv>; value: unknown }): OwnerLocale | null {
  const { context, value } = input;
  if (value === undefined) return context.get('locale');
  if (typeof value !== 'string') return null;
  return localeOfLanguageValue({ value });
}
