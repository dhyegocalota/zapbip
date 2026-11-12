import { HttpStatus, OwnerLocale, WaitlistJoinOutcome } from '@zapbip/types';
import type { Context } from 'hono';
import { type FormBody, textFieldOf } from '../backoffice/form-fields';
import { CLIENT_ADDRESS_HEADER } from '../contract/constants';
import { clientRateKey } from '../routes/client-rate-key';
import { BAD_REQUEST_TEXT, plainResponse, RETRY_AFTER_HEADER } from '../routes/private-response';
import { joinWaitlist, normalizeEmail } from './join-waitlist';
import { JoinState, type JoinView } from './page-model';
import { renderLanding } from './render-landing';
import { isWaitlistOpen } from './site-configuration';
import { NO_STORE_CACHE_CONTROL, RATE_KEY_PREFIX, RETRY_AFTER_VALUE, TURNSTILE_RESPONSE_FIELD } from './site-constants';
import type { SiteEnv } from './site-env';
import { TurnstileVerdict, verifyTurnstileToken } from './turnstile';

const EMAIL_FIELD = 'email';
const LOCALE_FIELD = 'locale';
const REFERRAL_FIELD = 'referralCode';
const LOCALES: string[] = Object.values(OwnerLocale);

type JoinAnswer = { view: JoinView; status: HttpStatus; headers?: Record<string, string> };
const NO_STORE_HEADERS = { 'Cache-Control': NO_STORE_CACHE_CONTROL };

function formLocaleOf(input: { form: FormBody; fallback: OwnerLocale }): OwnerLocale {
  const value = textFieldOf({ form: input.form, name: LOCALE_FIELD });
  return value !== null && LOCALES.includes(value) ? (value as OwnerLocale) : input.fallback;
}

async function answerOf(input: {
  context: Context<SiteEnv>;
  form: FormBody;
  clientAddress: string;
  fetchImplementation: typeof fetch;
}): Promise<JoinAnswer> {
  const { context, form, clientAddress, fetchImplementation } = input;
  const { env } = context;
  const emailValue = textFieldOf({ form, name: EMAIL_FIELD });
  const typedEmail = emailValue === null ? '' : emailValue;
  const { success: isWithinLimit } = await env.INSTALL_PAGE_LIMITER.limit({
    key: `${RATE_KEY_PREFIX}${clientRateKey({ address: clientAddress })}`,
  });
  if (!isWithinLimit)
    return {
      view: { state: JoinState.RateLimited, emailValue: typedEmail },
      status: HttpStatus.TooManyRequests,
      headers: { [RETRY_AFTER_HEADER]: RETRY_AFTER_VALUE },
    };
  if (!isWaitlistOpen({ env })) return { view: { state: JoinState.Paused }, status: HttpStatus.ServiceUnavailable };
  if (normalizeEmail({ email: typedEmail }) === null)
    return { view: { state: JoinState.InvalidEmail, emailValue: typedEmail }, status: HttpStatus.UnprocessableEntity };
  const tokenValue = textFieldOf({ form, name: TURNSTILE_RESPONSE_FIELD });
  const verdict = await verifyTurnstileToken({
    secret: env.TURNSTILE_SECRET_KEY!,
    token: tokenValue === null ? '' : tokenValue,
    expectedHostname: new URL(env.SITE_ORIGIN).hostname,
    acceptTestingKey: false,
    fetchImplementation,
  });
  if (verdict === TurnstileVerdict.Refused)
    return { view: { state: JoinState.CaptchaFailed, emailValue: typedEmail }, status: HttpStatus.Forbidden };
  if (verdict === TurnstileVerdict.Unavailable)
    return { view: { state: JoinState.Unavailable, emailValue: typedEmail }, status: HttpStatus.ServiceUnavailable };
  const referralValue = textFieldOf({ form, name: REFERRAL_FIELD });
  const result = await joinWaitlist({
    database: env.CONNECTIONS,
    email: typedEmail,
    locale: context.get('locale'),
    referralCode: referralValue,
    now: Date.now(),
  });
  if (result.outcome === WaitlistJoinOutcome.InvalidEmail)
    return { view: { state: JoinState.InvalidEmail, emailValue: typedEmail }, status: HttpStatus.UnprocessableEntity };
  if (result.outcome === WaitlistJoinOutcome.Unavailable)
    return { view: { state: JoinState.Unavailable, emailValue: typedEmail }, status: HttpStatus.ServiceUnavailable };
  return {
    view: { state: JoinState.Joined, referralCode: result.referralCode, creditedCount: result.creditedCount, cap: result.cap },
    status: HttpStatus.Ok,
  };
}

export function joinHandler(input: { fetchImplementation: typeof fetch }): (context: Context<SiteEnv>) => Promise<Response> {
  return async (context) => {
    const clientAddress = context.req.header(CLIENT_ADDRESS_HEADER);
    if (clientAddress === undefined) return plainResponse({ body: BAD_REQUEST_TEXT, status: HttpStatus.BadRequest });
    const form = await context.req.parseBody();
    context.set('locale', formLocaleOf({ form, fallback: context.get('locale') }));
    const answer = await answerOf({ context, form, clientAddress, fetchImplementation: input.fetchImplementation });
    return renderLanding({ context, join: answer.view, status: answer.status, headers: { ...NO_STORE_HEADERS, ...answer.headers } });
  };
}
