import { reset } from 'cloudflare:test';
import { DEFAULT_WAITLIST_REFERRAL_CAP, OwnerLocale, WAITLIST_REFERRAL_CODE_LENGTH } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeployEnvironment } from '../../src/contract/deploy-environment';
import { SiteCopyKey } from '../../src/site/site-copy';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { applyLandingWaitlistMigration } from '../support/seed';
import {
  acceptingTurnstile,
  copyHtml,
  joinForm,
  refusingTurnstile,
  REFERRAL_CODE,
  SITE_ORIGIN,
  SITE_TURNSTILE_SECRET,
  siteEnvironment,
  siteFetch,
  unreachableTurnstile,
  type SiteFetchRecording,
} from '../support/site';
import { rowOf, setCap, waitlistRows } from '../support/waitlist';
import { testEnv } from '../support/workers-env';

const ENGLISH = OwnerLocale.EnglishUs;
const PORTUGUESE = OwnerLocale.PortugueseBrazil;
const MARIA = 'maria@example.com';
const LINK_PATTERN = new RegExp(`${SITE_ORIGIN}/\\?ref=([a-z0-9]{${WAITLIST_REFERRAL_CODE_LENGTH}})`);

function copy(key: SiteCopyKey, values?: Record<string, string>): string {
  return copyHtml({ key, locale: ENGLISH, values });
}

function postJoin(input: {
  form: Record<string, string>;
  recording?: SiteFetchRecording;
  env?: ReturnType<typeof siteEnvironment>;
  withClientAddress?: boolean;
}) {
  return siteFetch({ path: '/join', method: 'POST', ...input });
}

async function joinAndReadCode(input: { email: string; referralCode?: string }): Promise<string> {
  const response = await postJoin({ form: joinForm(input) });
  const code = LINK_PATTERN.exec(await response.text())?.[1];
  if (code === undefined) throw new Error('the thank-you page carried no referral link');
  return code;
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('POST /join', () => {
  it('joins with the test widget and shows the personal link and 0 of 5', async () => {
    const recording = acceptingTurnstile();
    const response = await postJoin({ form: joinForm({ email: MARIA, locale: PORTUGUESE }), recording });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toMatch(LINK_PATTERN);
    expect(html).toContain(
      copyHtml({
        key: SiteCopyKey.ThanksInviteCount,
        locale: PORTUGUESE,
        values: { count: '0', cap: String(DEFAULT_WAITLIST_REFERRAL_CAP) },
      }),
    );
    expect(await rowOf({ email: MARIA })).toMatchObject({ locale: PORTUGUESE, credited: 0 });
    expect(recording.calls).toHaveLength(1);
    expect(recording.calls[0]).toContain(`secret=${SITE_TURNSTILE_SECRET}`);
  });

  it('the thank-you carries the copy button, the WhatsApp share link and never the email', async () => {
    const html = await (await postJoin({ form: joinForm({ email: MARIA }) })).text();
    expect(html).toContain(copy(SiteCopyKey.ThanksCopy));
    expect(html).toContain('href="https://wa.me/?text=');
    expect(html).toContain('id="invite-link"');
    expect(html).not.toContain(MARIA);
    expect(html).not.toContain(SITE_TURNSTILE_SECRET);
  });

  it('a duplicate email gets the same thank-you markup and no second row', async () => {
    const first = await (await postJoin({ form: joinForm({ email: MARIA }) })).text();
    const second = await (await postJoin({ form: joinForm({ email: 'Maria@Example.com ' }) })).text();
    expect(second).toBe(first);
    expect(await waitlistRows()).toHaveLength(1);
  });

  it('credits the referrer and shows it on the referrer thank-you', async () => {
    const referrerCode = await joinAndReadCode({ email: 'referrer@example.com' });
    await postJoin({ form: joinForm({ email: 'friend@example.com', referralCode: referrerCode }) });
    const again = await (await postJoin({ form: joinForm({ email: 'referrer@example.com' }) })).text();
    expect(again).toContain(copy(SiteCopyKey.ThanksInviteCount, { count: '1', cap: String(DEFAULT_WAITLIST_REFERRAL_CAP) }));
    expect(await rowOf({ email: 'friend@example.com' })).toMatchObject({ credited: 1, referred_by: referrerCode });
  });

  it('at the cap the thank-you says so', async () => {
    await setCap({ value: 1 });
    const referrerCode = await joinAndReadCode({ email: 'referrer@example.com' });
    await postJoin({ form: joinForm({ email: 'friend@example.com', referralCode: referrerCode }) });
    const html = await (await postJoin({ form: joinForm({ email: 'referrer@example.com' }) })).text();
    expect(html).toContain(copy(SiteCopyKey.ThanksCapReached));
  });

  it('refuses a failing widget with 403, the captcha notice and no row', async () => {
    const response = await postJoin({ form: joinForm({ email: MARIA }), recording: refusingTurnstile() });
    const html = await response.text();
    expect(response.status).toBe(403);
    expect(html).toContain(copy(SiteCopyKey.JoinCaptchaFailed));
    expect(html).toContain(`value="${MARIA}"`);
    expect(await waitlistRows()).toEqual([]);
  });

  it('refuses a missing token without calling Turnstile', async () => {
    const recording = acceptingTurnstile();
    const response = await postJoin({ form: joinForm({ email: MARIA, token: '' }), recording });
    expect(response.status).toBe(403);
    expect(recording.calls).toEqual([]);
    expect(await waitlistRows()).toEqual([]);
  });

  it('answers 503 with the unavailable notice when Turnstile is unreachable', async () => {
    const response = await postJoin({ form: joinForm({ email: MARIA }), recording: unreachableTurnstile() });
    expect(response.status).toBe(503);
    expect(await response.text()).toContain(copy(SiteCopyKey.JoinUnavailable));
    expect(await waitlistRows()).toEqual([]);
  });

  it.each(['not-an-email', ''])('answers 422 with the field error for %j, before any Turnstile call', async (email) => {
    const recording = acceptingTurnstile();
    const response = await postJoin({ form: joinForm({ email }), recording });
    const html = await response.text();
    expect(response.status).toBe(422);
    expect(html).toContain(copy(SiteCopyKey.JoinEmailInvalid));
    expect(html).toContain('aria-invalid="true"');
    expect(recording.calls).toEqual([]);
    expect(await waitlistRows()).toEqual([]);
  });

  it('answers 429 with Retry-After before any Turnstile call when the limiter is spent', async () => {
    const recording = acceptingTurnstile();
    const env = siteEnvironment({ overrides: { INSTALL_PAGE_LIMITER: createFakeRateLimiter({ limit: 0 }) } });
    const response = await postJoin({ form: joinForm({ email: MARIA }), recording, env });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.text()).toContain(copy(SiteCopyKey.JoinRateLimited));
    expect(recording.calls).toEqual([]);
  });

  it('answers 400 without a client address', async () => {
    const response = await postJoin({ form: joinForm({ email: MARIA }), withClientAddress: false });
    expect(response.status).toBe(400);
    expect(await waitlistRows()).toEqual([]);
  });

  it.each([undefined, '', '   '])('writes nothing and answers 503 with the paused notice when the secret is %j', async (secret) => {
    const recording = acceptingTurnstile();
    const env = siteEnvironment({ overrides: { TURNSTILE_SECRET_KEY: secret } });
    const response = await postJoin({ form: joinForm({ email: MARIA }), recording, env });
    expect(response.status).toBe(503);
    expect(await response.text()).toContain(copy(SiteCopyKey.JoinPausedTitle));
    expect(recording.calls).toEqual([]);
    expect(await waitlistRows()).toEqual([]);
  });

  it('answers 503 and writes nothing when the cap row is missing', async () => {
    await testEnv.CONNECTIONS.prepare('DELETE FROM site_settings').run();
    const response = await postJoin({ form: joinForm({ email: MARIA }) });
    expect(response.status).toBe(503);
    expect(await waitlistRows()).toEqual([]);
  });

  it('never caches the answer', async () => {
    const response = await postJoin({ form: joinForm({ email: MARIA }) });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('shares nothing about a referral code that does not exist', async () => {
    const response = await postJoin({ form: joinForm({ email: MARIA, referralCode: 'abcdefgh2345' }) });
    expect(response.status).toBe(200);
    expect(await rowOf({ email: MARIA })).toMatchObject({ credited: 0, referred_by: null });
  });

  describe('with a published testing key result', () => {
    function testingKeyTurnstile(): SiteFetchRecording {
      const calls: string[] = [];
      const fetchImplementation = (async (_url: string, init: RequestInit) => {
        calls.push(String(init.body));
        return Response.json({ success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } });
      }) as unknown as typeof fetch;
      return { fetchImplementation, calls };
    }

    it('joins in development', async () => {
      const env = siteEnvironment({ overrides: { ENVIRONMENT: DeployEnvironment.Development } });
      const response = await postJoin({ form: joinForm({ email: MARIA }), recording: testingKeyTurnstile(), env });
      expect(response.status).toBe(200);
      expect(await waitlistRows()).toHaveLength(1);
    });

    it.each([DeployEnvironment.Staging, DeployEnvironment.Production])('is refused in %s', async (environment) => {
      const env = siteEnvironment({ overrides: { ENVIRONMENT: environment } });
      const response = await postJoin({ form: joinForm({ email: MARIA }), recording: testingKeyTurnstile(), env });
      expect(response.status).toBe(403);
      expect(await waitlistRows()).toEqual([]);
    });
  });

  describe('a failed attempt keeps the referral code for the retry', () => {
    const hiddenField = `name="referralCode" value="${REFERRAL_CODE}"`;

    it('after an invalid email', async () => {
      const response = await postJoin({ form: joinForm({ email: 'not-an-email', referralCode: REFERRAL_CODE }) });
      expect(await response.text()).toContain(hiddenField);
    });

    it('after a refused widget', async () => {
      const response = await postJoin({ form: joinForm({ email: MARIA, referralCode: REFERRAL_CODE }), recording: refusingTurnstile() });
      expect(await response.text()).toContain(hiddenField);
    });

    it('after an unreachable widget', async () => {
      const response = await postJoin({ form: joinForm({ email: MARIA, referralCode: REFERRAL_CODE }), recording: unreachableTurnstile() });
      expect(await response.text()).toContain(hiddenField);
    });

    it('after a spent limiter', async () => {
      const env = siteEnvironment({ overrides: { INSTALL_PAGE_LIMITER: createFakeRateLimiter({ limit: 0 }) } });
      const response = await postJoin({ form: joinForm({ email: MARIA, referralCode: REFERRAL_CODE }), env });
      expect(await response.text()).toContain(hiddenField);
    });

    it('but not a malformed code', async () => {
      const response = await postJoin({ form: joinForm({ email: 'not-an-email', referralCode: '../../x' }) });
      expect(await response.text()).not.toContain('name="referralCode"');
    });
  });
});
