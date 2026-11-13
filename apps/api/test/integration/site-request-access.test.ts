import { reset } from 'cloudflare:test';
import { OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_ADDRESS_HEADER } from '../../src/contract/constants';
import { AGENT_ADDRESS_WEIGHT, AGENT_EMAIL_WEIGHT, AGENT_RATE_KEY_PREFIX } from '../../src/site/site-constants';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { createFakeRateLimiter, type FakeRateLimiter } from '../support/fake-rate-limiter';
import { applyLandingWaitlistMigration } from '../support/seed';
import { acceptingTurnstile, joinForm, siteEnvironment, siteFetch } from '../support/site';
import { joinedCodeOf, rowOf, waitlistRows } from '../support/waitlist';
import { testEnv } from '../support/workers-env';

const MARIA = 'maria@example.com';
const BINDING_LIMIT = 30;
const ADDRESS_ALLOWANCE = BINDING_LIMIT / AGENT_ADDRESS_WEIGHT;
const EMAIL_ALLOWANCE = BINDING_LIMIT / AGENT_EMAIL_WEIGHT;
const JSON_HEADERS = { 'content-type': 'application/json' };

type Answer = { status: string; language: string; message: string };
type Environment = ReturnType<typeof siteEnvironment>;

function request(input: { body: unknown; headers?: Record<string, string>; env?: Environment; withClientAddress?: boolean }) {
  const { body, headers = {}, env, withClientAddress } = input;
  return siteFetch({
    path: '/api/request-access',
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { ...JSON_HEADERS, ...headers },
    env,
    withClientAddress,
  });
}

async function answerOf(input: { response: Response }): Promise<Answer> {
  return (await input.response.json()) as Answer;
}

function copy(input: { key: SiteCopyKey; locale?: OwnerLocale }): string {
  return renderSiteCopy({ key: input.key, locale: input.locale === undefined ? OwnerLocale.EnglishUs : input.locale });
}

function limitedEnvironment(): Environment {
  return siteEnvironment({ overrides: { INSTALL_PAGE_LIMITER: createFakeRateLimiter({ limit: BINDING_LIMIT }) } });
}

async function statusesOf(input: { count: number; send: (index: number) => Promise<Response> }): Promise<number[]> {
  return Array.from({ length: input.count }, (_value, index) => index).reduce<Promise<number[]>>(async (previous, index) => {
    const done = await previous;
    return [...done, (await input.send(index)).status];
  }, Promise.resolve([]));
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('POST /api/request-access', () => {
  it('adds the email with source agent, no referrer and no captcha call', async () => {
    const recording = acceptingTurnstile();
    const response = await siteFetch({
      path: '/api/request-access',
      method: 'POST',
      body: JSON.stringify({ email: MARIA, language: 'en' }),
      headers: JSON_HEADERS,
      recording,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await answerOf({ response })).toEqual({
      status: 'requested',
      language: 'en',
      message: `${copy({ key: SiteCopyKey.ThanksTitle })} ${copy({ key: SiteCopyKey.ThanksBody })}`,
    });
    expect(await rowOf({ email: MARIA })).toMatchObject({ locale: OwnerLocale.EnglishUs, source: 'agent', referred_by: null, credited: 0 });
    expect(recording.calls).toHaveLength(0);
  });

  it('answers and stores in the language asked', async () => {
    const response = await request({ body: { email: MARIA, language: 'pt-BR' } });
    const answer = await answerOf({ response });
    expect(answer.language).toBe('pt-BR');
    expect(answer.message).toContain(copy({ key: SiteCopyKey.ThanksTitle, locale: OwnerLocale.PortugueseBrazil }));
    expect(await rowOf({ email: MARIA })).toMatchObject({ locale: OwnerLocale.PortugueseBrazil });
  });

  it('takes the language of the request when none is given', async () => {
    const response = await request({ body: { email: MARIA }, headers: { 'accept-language': 'pt-BR,pt;q=0.9' } });
    expect((await answerOf({ response })).language).toBe('pt-BR');
    expect(await rowOf({ email: MARIA })).toMatchObject({ locale: OwnerLocale.PortugueseBrazil });
  });

  it('answers a duplicate like a new request and writes one row', async () => {
    const first = await (await request({ body: { email: MARIA } })).text();
    const second = await (await request({ body: { email: ` ${MARIA.toUpperCase()} ` } })).text();
    expect(second).toBe(first);
    expect(await waitlistRows()).toHaveLength(1);
  });

  it('never credits a referrer, even when the body names one', async () => {
    const referrerCode = await joinedCodeOf({ email: 'referrer@example.com' });
    await request({ body: { email: 'friend@example.com', referralCode: referrerCode } });
    expect(await rowOf({ email: 'friend@example.com' })).toMatchObject({ referred_by: null, credited: 0 });
  });

  it.each([
    ['not an email', { email: 'not-an-email' }],
    ['no email', {}],
    ['a number', { email: 42 }],
    ['too long', { email: `${'a'.repeat(250)}@example.com` }],
  ])('refuses %s with 422 and writes nothing', async (_name, body) => {
    const response = await request({ body });
    expect(response.status).toBe(422);
    expect(await answerOf({ response })).toMatchObject({ status: 'invalid_email', message: copy({ key: SiteCopyKey.JoinEmailInvalid }) });
    expect(await waitlistRows()).toHaveLength(0);
  });

  it('refuses a language it does not serve with 422', async () => {
    const response = await request({ body: { email: MARIA, language: 'xx' } });
    expect(response.status).toBe(422);
    expect((await answerOf({ response })).status).toBe('unsupported_language');
    expect(await waitlistRows()).toHaveLength(0);
  });

  it('refuses a body that is not JSON and a body that is not an object with 400', async () => {
    const broken = await request({ body: '{"email":' });
    const list = await request({ body: ['a@example.com'] });
    expect(broken.status).toBe(400);
    expect(list.status).toBe(400);
    expect((await answerOf({ response: broken })).status).toBe('invalid_request');
  });

  it('refuses a form post with 415', async () => {
    const response = await siteFetch({ path: '/api/request-access', method: 'POST', form: joinForm({ email: MARIA }) });
    expect(response.status).toBe(415);
    expect(await waitlistRows()).toHaveLength(0);
  });

  it('refuses a request with no client address with 400', async () => {
    const response = await request({ body: { email: MARIA }, withClientAddress: false });
    expect(response.status).toBe(400);
  });

  it('sends no CORS header, so a page on another origin cannot read it', async () => {
    const response = await request({ body: { email: MARIA }, headers: { origin: 'https://evil.example' } });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('is paused with the form: no secret, no row, 503', async () => {
    const env = siteEnvironment({ overrides: { TURNSTILE_SECRET_KEY: '' } });
    const response = await request({ body: { email: MARIA }, env });
    expect(response.status).toBe(503);
    expect(await answerOf({ response })).toMatchObject({ status: 'paused', message: copy({ key: SiteCopyKey.JoinPausedBody }) });
    expect(await waitlistRows()).toHaveLength(0);
  });

  it('answers 503 unavailable when the cap row is gone', async () => {
    await testEnv.CONNECTIONS.prepare('DELETE FROM site_settings').run();
    const response = await request({ body: { email: MARIA } });
    expect(response.status).toBe(503);
    expect((await answerOf({ response })).status).toBe('unavailable');
  });
});

describe('the agent limits', () => {
  it('allows a few requests per address a minute, then answers 429', async () => {
    const env = limitedEnvironment();
    const statuses = await statusesOf({
      count: ADDRESS_ALLOWANCE + 1,
      send: (index) => request({ body: { email: `agent${index}@example.com` }, env }),
    });
    expect(statuses).toEqual([...Array(ADDRESS_ALLOWANCE).fill(200), 429]);
    expect(await waitlistRows()).toHaveLength(ADDRESS_ALLOWANCE);
  });

  it('answers the rate limit with Retry-After and the localized message', async () => {
    const env = limitedEnvironment();
    await statusesOf({ count: ADDRESS_ALLOWANCE, send: (index) => request({ body: { email: `agent${index}@example.com` }, env }) });
    const response = await request({ body: { email: 'late@example.com' }, env });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await answerOf({ response })).toMatchObject({ status: 'rate_limited', message: copy({ key: SiteCopyKey.JoinRateLimited }) });
  });

  it('limits one email across addresses', async () => {
    const env = limitedEnvironment();
    const statuses = await statusesOf({
      count: EMAIL_ALLOWANCE + 1,
      send: (index) => request({ body: { email: MARIA }, env, headers: { [CLIENT_ADDRESS_HEADER]: `198.51.100.${index + 1}` } }),
    });
    expect(statuses).toEqual([...Array(EMAIL_ALLOWANCE).fill(200), 429]);
  });

  it('keeps its counters apart from the form: a spent agent budget does not block a person', async () => {
    const env = limitedEnvironment();
    await statusesOf({ count: ADDRESS_ALLOWANCE + 1, send: (index) => request({ body: { email: `agent${index}@example.com` }, env }) });
    const person = await siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: 'person@example.com' }), env });
    const keys = (env.INSTALL_PAGE_LIMITER as FakeRateLimiter).calls;
    expect(person.status).toBe(200);
    expect(keys.filter((key) => key.startsWith(AGENT_RATE_KEY_PREFIX)).length).toBeGreaterThan(0);
    expect(keys.filter((key) => key.startsWith('join:'))).toHaveLength(1);
  });
});

describe('the human form after the migration', () => {
  it('still writes source form', async () => {
    await siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: MARIA }) });
    expect(await rowOf({ email: MARIA })).toMatchObject({ source: 'form' });
  });
});
