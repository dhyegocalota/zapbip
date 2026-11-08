import { RATE_LIMIT_PERIOD_MS } from '@zapbip/core';
import { MINUTE_MS, OwnerLocale, SECOND_MS, START_LINK_LANGUAGE_PARAMETER, START_LINK_PATH } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { CLIENT_ADDRESS_HEADER } from '../contract/constants';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import type { NumberRegistry } from '../numbers/number-registry';
import { clientRateKey } from './client-rate-key';
import { HttpStatus } from './http-status';
import type { RateLimiter } from './install-page';
import { plainResponse, privateResponse } from './private-response';
import { startLinkLocaleOf } from './start-link-language';
import { renderStartUnavailablePage } from './start-link-page';
import { START_LINK_STYLE_HASH } from './start-link-style';
import { startLinkTarget } from './start-link-target';

export type StartLinkRouteDependencies = {
  registry: Pick<NumberRegistry, 'findStartDisplayNumber'>;
  limiter: RateLimiter;
};

const RATE_KEY_PREFIX = 'start:';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const NOT_FOUND_TEXT = 'not found';
const BAD_REQUEST_TEXT = 'bad request';
const SERVER_ERROR_TEXT = 'server error';
const RATE_LIMITED_TEXT = 'too many requests';
const RETRY_AFTER_HEADER = 'Retry-After';
const RATE_LIMIT_RETRY_AFTER_SECONDS = RATE_LIMIT_PERIOD_MS / SECOND_MS;
const UNAVAILABLE_RETRY_AFTER_SECONDS = MINUTE_MS / SECOND_MS;
const UNAVAILABLE_CONTENT_SECURITY_POLICY = `default-src 'none'; style-src '${START_LINK_STYLE_HASH}'`;

function unavailableResponse(input: { locale: OwnerLocale }): Response {
  return privateResponse({
    body: renderStartUnavailablePage({ locale: input.locale }),
    status: HttpStatus.ServiceUnavailable,
    headers: {
      'Content-Type': HTML_CONTENT_TYPE,
      'Content-Security-Policy': UNAVAILABLE_CONTENT_SECURITY_POLICY,
      [RETRY_AFTER_HEADER]: String(UNAVAILABLE_RETRY_AFTER_SECONDS),
    },
  });
}

export function createStartLinkRoute(input: StartLinkRouteDependencies): Hono {
  const route = new Hono();

  async function serve(context: Context): Promise<Response> {
    const clientAddress = context.req.header(CLIENT_ADDRESS_HEADER);
    if (clientAddress === undefined) return plainResponse({ body: BAD_REQUEST_TEXT, status: HttpStatus.BadRequest });
    const { success } = await input.limiter.limit({ key: `${RATE_KEY_PREFIX}${clientRateKey({ address: clientAddress })}` });
    if (!success) {
      return plainResponse({
        body: RATE_LIMITED_TEXT,
        status: HttpStatus.TooManyRequests,
        headers: { [RETRY_AFTER_HEADER]: String(RATE_LIMIT_RETRY_AFTER_SECONDS) },
      });
    }
    const locale = startLinkLocaleOf({ values: context.req.queries(START_LINK_LANGUAGE_PARAMETER) });
    if (locale === null) return plainResponse({ body: BAD_REQUEST_TEXT, status: HttpStatus.BadRequest });
    const displayNumber = await input.registry.findStartDisplayNumber();
    if (displayNumber === null) return unavailableResponse({ locale });
    const target = startLinkTarget({ displayNumber, locale });
    if (target === null) {
      logEvent({ event: LogEvent.StartLinkInvalidNumber });
      return unavailableResponse({ locale });
    }
    return privateResponse({ body: null, status: HttpStatus.Found, headers: { Location: target } });
  }

  route.get(START_LINK_PATH, serve);
  route.notFound(() => plainResponse({ body: NOT_FOUND_TEXT, status: HttpStatus.NotFound }));
  route.onError(() => {
    logEvent({ event: LogEvent.StartLinkFailed });
    return plainResponse({ body: SERVER_ERROR_TEXT, status: HttpStatus.InternalServerError });
  });
  return route;
}
