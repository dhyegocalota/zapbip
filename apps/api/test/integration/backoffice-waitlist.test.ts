import {
  DEFAULT_WAITLIST_REFERRAL_CAP,
  OwnerLocale,
  WaitlistSource,
  SiteSettingKey,
  WAITLIST_REFERRAL_CAP_MAX,
  WAITLIST_REFERRAL_CAP_MIN,
} from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { WAITLIST_PAGE_ROW_LIMIT } from '../../src/backoffice/backoffice-constants';
import { readReferralCap } from '../../src/site/site-settings';
import { escapedHtml } from '../support/site';
import { resetWaitlist, seedWaitlistRow } from '../support/waitlist';
import { testEnv } from '../support/workers-env';
import { requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';
import {
  endBackofficeSession,
  followRedirect,
  getPage,
  NOW,
  postAction,
  postForm,
  refusingStepUpEnv,
  startBackofficeSession,
} from './backoffice-numbers-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_UNPROCESSABLE = 422;
const STATUS_TOO_MANY_REQUESTS = 429;
const WAITLIST_PATH = '/waitlist';
const EXPORT_PATH = '/waitlist/export.csv';
const CAP_PATH = '/waitlist/cap';
const CAP_FIELD = 'cap';
const CSV_HEADER = 'email,entrou_em,indicacoes_creditadas,indicado_por,origem\n';
const ENGLISH_CSV_HEADER = 'email,joined_at,credited_referrals,referred_by,source\n';
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];
const MINUTE = 60_000;

let sessionToken: string;

function copyHtml(input: { key: BackofficeCopyKey; values?: Record<string, string> }): string {
  const { key, values = {} } = input;
  return escapedHtml({ text: Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), copy[key]) });
}

async function auditRows(): Promise<{ action: string; outcome: string; target_id: string | null }[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT action, outcome, target_id FROM backoffice_audit ORDER BY at, rowid').all<{
    action: string;
    outcome: string;
    target_id: string | null;
  }>();
  return results;
}

async function actionRows(input: { action: BackofficeAuditAction }): Promise<{ outcome: string; target_id: string | null }[]> {
  return (await auditRows())
    .filter((row) => row.action === input.action)
    .map((row) => ({ outcome: row.outcome, target_id: row.target_id }));
}

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await resetWaitlist();
});

afterEach(async () => {
  endBackofficeSession();
  await resetWaitlist();
});

describe('the waitlist page', () => {
  test.each([WAITLIST_PATH, EXPORT_PATH])('redirects %s to sign-in without a session', async (path) => {
    const response = await requestBackoffice({ path });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe('/sign-in');
  });

  test('refuses the cap change without a session', async () => {
    const response = await requestBackoffice({ path: CAP_PATH, method: 'POST', form: { [CAP_FIELD]: '3' } });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
  });

  test('shows the empty state, the total 0 and the cap form with the current cap', async () => {
    const response = await getPage({ path: WAITLIST_PATH, sessionToken });
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.WaitlistEmptyTitle }));
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.WaitlistTotalLabel }));
    expect(html).toContain(`value="${DEFAULT_WAITLIST_REFERRAL_CAP}"`);
    expect(html).toContain(`href="${WAITLIST_PATH}"`);
  });

  test('lists the people in queue order with their referrer and credited count', async () => {
    await seedWaitlistRow({ email: 'first@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: NOW });
    await seedWaitlistRow({ email: 'second@example.com', referralCode: 'bbbbbbbbbbbb', createdAt: NOW + MINUTE });
    await seedWaitlistRow({
      email: 'friend@example.com',
      referralCode: 'cccccccccccc',
      referredBy: 'bbbbbbbbbbbb',
      credited: 1,
      createdAt: NOW + 2 * MINUTE,
    });
    const html = await (await getPage({ path: WAITLIST_PATH, sessionToken })).text();
    expect(html.indexOf('second@example.com')).toBeLessThan(html.indexOf('first@example.com'));
    expect(html.match(/class="waitlist-row"/g)).toHaveLength(3);
    expect(html).toContain('data-total="3"');
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.WaitlistExport }));
  });

  test('shows the source of each row', async () => {
    await seedWaitlistRow({ email: 'person@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: NOW });
    await seedWaitlistRow({
      email: 'robot@example.com',
      referralCode: 'bbbbbbbbbbbb',
      source: WaitlistSource.Agent,
      createdAt: NOW + MINUTE,
    });
    const html = await (await getPage({ path: WAITLIST_PATH, sessionToken })).text();
    const rows = html.split('class="waitlist-row"').slice(1);
    const robot = rows.find((row) => row.includes('robot@example.com'))!;
    const person = rows.find((row) => row.includes('person@example.com'))!;
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.WaitlistColumnSource }));
    expect(robot).toContain(copyHtml({ key: BackofficeCopyKey.SourceAgent }));
    expect(person).toContain(copyHtml({ key: BackofficeCopyKey.SourceForm }));
  });

  test('shows a truncation notice above the row limit and still counts everyone', async () => {
    const total = WAITLIST_PAGE_ROW_LIMIT + 1;
    await testEnv.CONNECTIONS.batch(
      Array.from({ length: total }, (_, index) =>
        testEnv.CONNECTIONS.prepare(
          'INSERT INTO landing_waitlist (email, locale, referral_code, referred_by, credited, created_at) VALUES (?, ?, ?, NULL, 0, ?)',
        ).bind(`person${index}@example.com`, OwnerLocale.EnglishUs, `code${String(index).padStart(8, '0')}`, NOW + index),
      ),
    );
    const html = await (await getPage({ path: WAITLIST_PATH, sessionToken })).text();
    expect(html.match(/class="waitlist-row"/g)).toHaveLength(WAITLIST_PAGE_ROW_LIMIT);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.WaitlistTruncated, values: { limit: String(WAITLIST_PAGE_ROW_LIMIT) } }));
    expect(html).toContain(`data-total="${total}"`);
  });

  test('replaces the cap form with an error notice when the cap row is missing', async () => {
    await testEnv.CONNECTIONS.prepare('DELETE FROM site_settings').run();
    const response = await getPage({ path: WAITLIST_PATH, sessionToken });
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.WaitlistCapMissing }));
    expect(html).not.toContain(`name="${CAP_FIELD}"`);
  });

  test('puts Waitlist in the primary navigation', async () => {
    const html = await (await getPage({ path: '/', sessionToken })).text();
    expect(html).toContain(`href="${WAITLIST_PATH}"`);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.NavigationWaitlist }));
  });
});

describe('the cap change', () => {
  test('stores the new cap with a step-up code, audits it and applies to the next read', async () => {
    const posted = await postAction({ path: CAP_PATH, sessionToken, fields: { [CAP_FIELD]: '2' } });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(posted.headers.get('Location')).toBe(`${WAITLIST_PATH}?notice=WaitlistCapSaved`);
    expect(await readReferralCap({ database: testEnv.CONNECTIONS })).toBe(2);
    expect(await actionRows({ action: BackofficeAuditAction.ReferralCapChanged })).toEqual([
      { outcome: BackofficeAuditOutcome.Succeeded, target_id: SiteSettingKey.WaitlistReferralCap },
    ]);
    const html = await (await followRedirect({ posted, sessionToken })).text();
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.WaitlistCapSaved }));
    expect(html).toContain('value="2"');
  });

  test.each([String(WAITLIST_REFERRAL_CAP_MIN), String(WAITLIST_REFERRAL_CAP_MAX)])('accepts the boundary %s', async (cap) => {
    const posted = await postAction({ path: CAP_PATH, sessionToken, fields: { [CAP_FIELD]: cap } });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(await readReferralCap({ database: testEnv.CONNECTIONS })).toBe(Number(cap));
  });

  test.each(['0', '101', '5.5', 'five', ''])('refuses %j with a field error, keeps the cap and audits nothing', async (cap) => {
    const posted = await postAction({ path: CAP_PATH, sessionToken, fields: { [CAP_FIELD]: cap } });
    const followed = await followRedirect({ posted, sessionToken });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNPROCESSABLE);
    const html = await followed.text();
    expect(html).toContain(
      copyHtml({
        key: BackofficeCopyKey.FieldErrorCapRange,
        values: { min: String(WAITLIST_REFERRAL_CAP_MIN), max: String(WAITLIST_REFERRAL_CAP_MAX) },
      }),
    );
    expect(await readReferralCap({ database: testEnv.CONNECTIONS })).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
    expect(await actionRows({ action: BackofficeAuditAction.ReferralCapChanged })).toEqual([]);
  });

  test('refuses a change without a step-up code, keeps the cap and records one failed step-up', async () => {
    const posted = await postAction({ path: CAP_PATH, sessionToken, fields: { [CAP_FIELD]: '2' }, code: '' });
    const followed = await followRedirect({ posted, sessionToken });
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await followed.text()).toContain(copyHtml({ key: BackofficeCopyKey.StepUpRejected }));
    expect(await readReferralCap({ database: testEnv.CONNECTIONS })).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
    expect(await actionRows({ action: BackofficeAuditAction.StepUpFailed })).toHaveLength(1);
    expect(await actionRows({ action: BackofficeAuditAction.ReferralCapChanged })).toEqual([]);
  });

  test('refuses a wrong step-up code', async () => {
    const posted = await postAction({ path: CAP_PATH, sessionToken, fields: { [CAP_FIELD]: '2' }, code: '000000' });
    expect((await followRedirect({ posted, sessionToken })).status).toBe(STATUS_UNAUTHORIZED);
    expect(await readReferralCap({ database: testEnv.CONNECTIONS })).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
  });

  test('answers 429 when the step-up limiter is spent', async () => {
    const posted = await postAction({ path: CAP_PATH, sessionToken, fields: { [CAP_FIELD]: '2' }, env: refusingStepUpEnv() });
    expect(posted.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(await readReferralCap({ database: testEnv.CONNECTIONS })).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
  });

  test('refuses a post from another origin', async () => {
    const posted = await postForm({
      path: CAP_PATH,
      sessionToken,
      fields: { [CAP_FIELD]: '2', code: '123456' },
      origin: 'https://evil.example',
    });
    expect(posted.status).toBe(STATUS_FORBIDDEN);
    expect(await readReferralCap({ database: testEnv.CONNECTIONS })).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
  });

  test('refuses a post without the csrf token', async () => {
    const posted = await postForm({ path: CAP_PATH, sessionToken, fields: { [CAP_FIELD]: '2', code: '123456' }, csrf: 'forged' });
    expect(posted.status).toBe(STATUS_FORBIDDEN);
  });
});

describe('the CSV export', () => {
  test('downloads the whole list with the header, the day in the file name and an audit row', async () => {
    await seedWaitlistRow({ email: 'first@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: NOW });
    await seedWaitlistRow({
      email: 'friend@example.com',
      referralCode: 'bbbbbbbbbbbb',
      referredBy: 'aaaaaaaaaaaa',
      credited: 1,
      createdAt: NOW + MINUTE,
    });
    const response = await getPage({ path: EXPORT_PATH, sessionToken });
    const body = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="zapbip-waitlist-2026-11-07.csv"');
    expect(body.startsWith(CSV_HEADER)).toBe(true);
    expect(body.indexOf('first@example.com')).toBeLessThan(body.indexOf('friend@example.com'));
    expect(body).toContain('"friend@example.com","2026-11-07T12:01:00.000Z","0","first@example.com","form"');
    expect(await actionRows({ action: BackofficeAuditAction.WaitlistExported })).toEqual([
      { outcome: BackofficeAuditOutcome.Succeeded, target_id: null },
    ]);
  });

  test('carries the source of every row, agent rows included', async () => {
    await seedWaitlistRow({ email: 'person@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: NOW });
    await seedWaitlistRow({
      email: 'robot@example.com',
      referralCode: 'bbbbbbbbbbbb',
      source: WaitlistSource.Agent,
      createdAt: NOW + MINUTE,
    });
    const body = await (await getPage({ path: EXPORT_PATH, sessionToken })).text();
    expect(body).toContain('"person@example.com","2026-11-07T12:00:00.000Z","0","","form"');
    expect(body).toContain('"robot@example.com","2026-11-07T12:01:00.000Z","0","","agent"');
  });

  test('carries everyone even above the page limit', async () => {
    const total = WAITLIST_PAGE_ROW_LIMIT + 2;
    await testEnv.CONNECTIONS.batch(
      Array.from({ length: total }, (_, index) =>
        testEnv.CONNECTIONS.prepare(
          'INSERT INTO landing_waitlist (email, locale, referral_code, referred_by, credited, created_at) VALUES (?, ?, ?, NULL, 0, ?)',
        ).bind(`person${index}@example.com`, OwnerLocale.EnglishUs, `code${String(index).padStart(8, '0')}`, NOW + index),
      ),
    );
    const body = await (await getPage({ path: EXPORT_PATH, sessionToken })).text();
    expect(body.split('\n')).toHaveLength(total + 2);
  });

  test('exports only the header for an empty list', async () => {
    expect(await (await getPage({ path: EXPORT_PATH, sessionToken })).text()).toBe(CSV_HEADER);
  });

  test('writes the header in English for an English browser', async () => {
    const response = await requestBackoffice({
      path: EXPORT_PATH,
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { 'Accept-Language': 'en-US' },
    });
    expect(await response.text()).toBe(ENGLISH_CSV_HEADER);
  });
});
