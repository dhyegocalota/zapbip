import { ACCESS_BATCH_LIMIT, AccountState, DAY_MS, OwnerLocale, WAITLIST_INVITE_TTL_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { maskedPhoneOf } from '../../src/client-app/masked-phone';
import { escapedHtml } from '../support/site';
import { seedInvite, seedWaitingAccount, seedWaitlistEntry, stateOfAccount } from '../support/access';
import { readScreen } from '../support/inbox-session';
import { resetWaitlist } from '../support/waitlist';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { BACKOFFICE_ORIGIN, backofficeEnv, requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';
import {
  endBackofficeSession,
  followRedirect,
  getPage,
  NOW,
  nextCode,
  refusingStepUpEnv,
  startBackofficeSession,
} from './backoffice-numbers-fixtures';
import { bindingsWith, deliver, WA_ID } from './owner-inbound-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_UNPROCESSABLE = 422;
const STATUS_TOO_MANY_REQUESTS = 429;
const ACCESS_PATH = '/access';
const RELEASE_PATH = '/access/release';
const INVITE_PATH = '/access/invite';
const CSV_PATH = '/access/invites.csv';
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];
const FIRST_PHONE = '5511911110001';
const SECOND_PHONE = '5511911110002';
const ENGLISH_PHONE = '14155550101';
const HOUR = 3_600_000;
const START_DISPLAY_NUMBER = '+5511977770000';
const ACCESS_OPENED_TEXT = 'Seu acesso ao zapbip está aberto';

let sessionToken: string;

function copyHtml(input: { key: BackofficeCopyKey; values?: Record<string, string> }): string {
  const { key, values = {} } = input;
  return escapedHtml({ text: Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), copy[key]) });
}

async function postBatch(input: {
  path: string;
  fields: [string, string][];
  code?: string;
  origin?: string;
  csrf?: string;
  env?: Parameters<typeof requestBackoffice>[0]['env'];
}): Promise<Response> {
  const { origin = BACKOFFICE_ORIGIN } = input;
  const code = input.code === undefined ? await nextCode() : input.code;
  const csrf = input.csrf === undefined ? await csrfTokenOf({ sessionToken }) : input.csrf;
  return requestBackoffice({
    path: input.path,
    method: 'POST',
    form: new URLSearchParams([...input.fields, ['code', code], ['csrf', csrf]]),
    cookies: { [SESSION_COOKIE]: sessionToken },
    headers: { Origin: origin },
    env: input.env,
  });
}

function accounts(...accountIds: string[]): [string, string][] {
  return accountIds.map((accountId) => ['account', accountId]);
}

function emails(...addresses: string[]): [string, string][] {
  return addresses.map((address) => ['email', address]);
}

async function auditRows(input: { action: BackofficeAuditAction }): Promise<{ outcome: string; target_id: string | null }[]> {
  const { results } = await testEnv.CONNECTIONS.prepare(
    'SELECT outcome, target_id FROM backoffice_audit WHERE action = ? ORDER BY at, rowid',
  )
    .bind(input.action)
    .all<{ outcome: string; target_id: string | null }>();
  return results;
}

async function inviteRows(): Promise<{ email: string; code_digest: string; used_at: number | null }[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT email, code_digest, used_at FROM waitlist_invites ORDER BY rowid').all<{
    email: string;
    code_digest: string;
    used_at: number | null;
  }>();
  return results;
}

async function screenOf(input: { accountId: string }) {
  return readScreen({ stub: accountInboxStub({ accountId: input.accountId }) });
}

async function seedTwoWaiting(): Promise<void> {
  await seedWaitingAccount({
    accountId: 'acct_first',
    phone: FIRST_PHONE,
    locale: OwnerLocale.PortugueseBrazil,
    createdAt: NOW - 2 * DAY_MS,
  });
  await seedWaitingAccount({
    accountId: 'acct_second',
    phone: SECOND_PHONE,
    locale: OwnerLocale.PortugueseBrazil,
    createdAt: NOW - DAY_MS,
  });
}

beforeEach(async () => {
  await testEnv.CONNECTIONS.prepare('DELETE FROM owner_identities').run();
  sessionToken = await startBackofficeSession();
  await resetWaitlist();
  await seedWhatsAppNumber({ displayNumber: START_DISPLAY_NUMBER });
});

afterEach(() => {
  endBackofficeSession();
  vi.restoreAllMocks();
});

describe('the access page', () => {
  test.each([ACCESS_PATH, CSV_PATH])('redirects %s to sign-in without a session', async (path) => {
    const response = await requestBackoffice({ path });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe('/sign-in');
  });

  test.each([RELEASE_PATH, INVITE_PATH])('refuses %s without a session', async (path) => {
    const response = await requestBackoffice({ path, method: 'POST', form: { account: 'acct_first' } });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
  });

  test('shows both empty states', async () => {
    const html = await (await getPage({ path: ACCESS_PATH, sessionToken })).text();
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AccessWaitingEmpty }));
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AccessInviteEmpty }));
    expect(html).toContain(`href="${ACCESS_PATH}"`);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.NavigationAccess }));
  });

  test('lists only waitlisted accounts, oldest first, with a masked phone and a checkbox', async () => {
    await seedTwoWaiting();
    await seedWaitingAccount({ accountId: 'acct_active', phone: '5511911110003', state: AccountState.Active, createdAt: NOW });
    await seedWaitingAccount({ accountId: 'acct_suspended', phone: '5511911110004', state: AccountState.Suspended, createdAt: NOW });
    const html = await (await getPage({ path: ACCESS_PATH, sessionToken })).text();
    expect(html).toContain(escapedHtml({ text: maskedPhoneOf({ waId: FIRST_PHONE }) }));
    expect(html).not.toContain(FIRST_PHONE);
    expect(html.indexOf('value="acct_first"')).toBeLessThan(html.indexOf('value="acct_second"'));
    expect(html).toContain('type="checkbox" name="account" value="acct_first"');
    expect(html).not.toContain('acct_active');
    expect(html).not.toContain('acct_suspended');
  });

  test('filters the waiting accounts by language and by the day they joined', async () => {
    await seedTwoWaiting();
    await seedWaitingAccount({ accountId: 'acct_english', phone: ENGLISH_PHONE, locale: OwnerLocale.EnglishUs, createdAt: NOW - DAY_MS });
    const english = await (await getPage({ path: `${ACCESS_PATH}?locale=${OwnerLocale.EnglishUs}`, sessionToken })).text();
    expect(english).toContain('value="acct_english"');
    expect(english).not.toContain('value="acct_first"');
    const day = new Date(NOW - 2 * DAY_MS).toISOString().slice(0, 10);
    const dated = await (await getPage({ path: `${ACCESS_PATH}?from=${day}&to=${day}`, sessionToken })).text();
    expect(dated).toContain('value="acct_first"');
    expect(dated).not.toContain('value="acct_second"');
  });

  test('lists email entries without a live or used invite and hides the invited ones', async () => {
    await seedWaitlistEntry({ email: 'fresh@example.com', createdAt: NOW - DAY_MS });
    await seedWaitlistEntry({ email: 'live@example.com', createdAt: NOW - DAY_MS });
    await seedWaitlistEntry({ email: 'used@example.com', createdAt: NOW - DAY_MS });
    await seedWaitlistEntry({ email: 'expired@example.com', createdAt: NOW - DAY_MS });
    await seedInvite({ email: 'live@example.com', digest: 'd1', createdAt: NOW - HOUR, expiresAt: NOW + DAY_MS });
    await seedInvite({ email: 'used@example.com', digest: 'd2', createdAt: NOW - 2 * DAY_MS, expiresAt: NOW - HOUR, usedAt: NOW - DAY_MS });
    await seedInvite({ email: 'expired@example.com', digest: 'd3', createdAt: NOW - 40 * DAY_MS, expiresAt: NOW - DAY_MS });
    const html = await (await getPage({ path: ACCESS_PATH, sessionToken })).text();
    expect(html).toContain('value="fresh@example.com"');
    expect(html).toContain('value="expired@example.com"');
    expect(html).not.toContain('value="live@example.com"');
    expect(html).not.toContain('value="used@example.com"');
  });
});

describe('releasing access', () => {
  test('moves the ticked accounts to active, queues the notice behind the template, audits the counts and shows the result', async () => {
    await seedTwoWaiting();
    const posted = await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first', 'acct_second') });
    const html = await posted.text();
    expect(posted.status).toBe(STATUS_OK);
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Active);
    expect(await stateOfAccount({ accountId: 'acct_second' })).toBe(AccountState.Active);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AccessReleaseResultTitle }));
    const screens = await Promise.all([screenOf({ accountId: 'acct_first' }), screenOf({ accountId: 'acct_second' })]);
    expect(screens.map((screen) => screen.filter((entry) => entry.template !== null))).toEqual([[expect.anything()], [expect.anything()]]);
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([
      {
        outcome: BackofficeAuditOutcome.Succeeded,
        target_id: 'selected=2 released=2 alreadyActive=0 notReleasable=0 sent=0 queued=2 failed=0',
      },
    ]);
    expect(html).toContain('data-count="queued">2<');
    expect(html).toContain('data-count="released">2<');
  });

  test('tells an owner whose window is open in the session', async () => {
    await deliver({ bindings: bindingsWith({ waitlistEnabled: true }), text: 'oi' });
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT account_id FROM owner_identities WHERE wa_id = ?')
      .bind(WA_ID)
      .all<{ account_id: string }>();
    const [owner] = results;
    if (owner === undefined) throw new Error('the owner account is missing');
    const html = await (await postBatch({ path: RELEASE_PATH, fields: accounts(owner.account_id) })).text();
    expect((await screenOf({ accountId: owner.account_id })).map((entry) => entry.text)).toContainEqual(
      expect.stringContaining(ACCESS_OPENED_TEXT),
    );
    expect(html).toContain('data-count="sent">1<');
    expect(await stateOfAccount({ accountId: owner.account_id })).toBe(AccountState.Active);
  });

  test('releasing again is a no-op that sends nothing', async () => {
    await seedTwoWaiting();
    await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first') });
    const before = await screenOf({ accountId: 'acct_first' });
    const html = await (await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first') })).text();
    expect(await screenOf({ accountId: 'acct_first' })).toEqual(before);
    expect(html).toContain('data-count="alreadyActive">1<');
    expect(html).toContain('data-count="released">0<');
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toHaveLength(2);
  });

  test('never moves a suspended account and counts an unknown id as not releasable', async () => {
    await seedWaitingAccount({ accountId: 'acct_suspended', phone: SECOND_PHONE, state: AccountState.Suspended, createdAt: NOW });
    const html = await (await postBatch({ path: RELEASE_PATH, fields: accounts('acct_suspended', 'acct_missing') })).text();
    expect(await stateOfAccount({ accountId: 'acct_suspended' })).toBe(AccountState.Suspended);
    expect(html).toContain('data-count="notReleasable">2<');
  });

  test.each([
    ['the object rejects', () => Promise.reject(new Error('the object is down'))],
    ['the object refuses the notice', () => Promise.resolve({ ok: false, errorCode: 'delivery_failed', message: 'the notice failed' })],
  ])('reports an account whose notice could not be delivered when %s and keeps it released', async (_name, noticeAccessOpened) => {
    await seedTwoWaiting();
    const namespace = testEnv.ACCOUNT_INBOX;
    const failingNamespace = { idFromName: namespace.idFromName.bind(namespace), get: () => ({ noticeAccessOpened }) };
    const env = backofficeEnv({ overrides: { ACCOUNT_INBOX: failingNamespace as unknown as typeof namespace } });
    const html = await (await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first'), env })).text();
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Active);
    expect(html).toContain('data-count="failed">1<');
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AccessResultFailedList }));
    expect(html).toContain(escapedHtml({ text: maskedPhoneOf({ waId: FIRST_PHONE }) }));
    expect(html).not.toContain(FIRST_PHONE);
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([
      {
        outcome: BackofficeAuditOutcome.Succeeded,
        target_id: 'selected=1 released=1 alreadyActive=0 notReleasable=0 sent=0 queued=0 failed=1',
      },
    ]);
  });

  test('takes the first batch of everyone matching the filters when select all is ticked', async () => {
    await Promise.all(
      Array.from({ length: ACCESS_BATCH_LIMIT + 2 }, (_, index) =>
        seedWaitingAccount({
          accountId: `acct_${index}`,
          phone: `551191111${String(index).padStart(4, '0')}`,
          createdAt: NOW - DAY_MS + index,
        }),
      ),
    );
    const html = await (
      await postBatch({
        path: RELEASE_PATH,
        fields: [
          ['select_all', '1'],
          ['locale', OwnerLocale.EnglishUs],
        ],
      })
    ).text();
    expect(html).toContain(`data-count="released">${ACCESS_BATCH_LIMIT}<`);
    expect(await stateOfAccount({ accountId: `acct_${ACCESS_BATCH_LIMIT}` })).toBe(AccountState.Waitlisted);
  });

  test('refuses an empty selection and one above the limit, changing nothing', async () => {
    await seedTwoWaiting();
    const empty = await postBatch({ path: RELEASE_PATH, fields: [] });
    const emptyFollowed = await followRedirect({ posted: empty, sessionToken });
    expect(emptyFollowed.status).toBe(STATUS_UNPROCESSABLE);
    expect(await emptyFollowed.text()).toContain(copyHtml({ key: BackofficeCopyKey.AccessNothingSelected }));
    const tooMany = await postBatch({
      path: RELEASE_PATH,
      fields: accounts(...Array.from({ length: ACCESS_BATCH_LIMIT + 1 }, (_, index) => `acct_${index}`)),
    });
    const tooManyFollowed = await followRedirect({ posted: tooMany, sessionToken });
    expect(tooManyFollowed.status).toBe(STATUS_UNPROCESSABLE);
    expect(await tooManyFollowed.text()).toContain(
      copyHtml({ key: BackofficeCopyKey.AccessBatchTooLarge, values: { limit: String(ACCESS_BATCH_LIMIT) } }),
    );
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Waitlisted);
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([]);
  });

  test.each([
    ['without a step-up code', ''],
    ['with a wrong step-up code', '000000'],
  ])('refuses %s and changes nothing', async (_name, code) => {
    await seedTwoWaiting();
    const posted = await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first'), code });
    const followed = await followRedirect({ posted, sessionToken });
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await followed.text()).toContain(copyHtml({ key: BackofficeCopyKey.StepUpRejected }));
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Waitlisted);
    expect(await auditRows({ action: BackofficeAuditAction.StepUpFailed })).toHaveLength(1);
  });

  test('answers 429 when the step-up limiter is spent', async () => {
    await seedTwoWaiting();
    const posted = await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first'), env: refusingStepUpEnv() });
    expect(posted.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Waitlisted);
  });

  test('refuses another origin and a forged token', async () => {
    await seedTwoWaiting();
    expect((await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first'), origin: 'https://evil.example' })).status).toBe(
      STATUS_FORBIDDEN,
    );
    expect((await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first'), csrf: 'forged' })).status).toBe(STATUS_FORBIDDEN);
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Waitlisted);
  });
});

describe('inviting the email waitlist', () => {
  test('issues one single-use code per entry, shows the links once, stores digests and audits the counts', async () => {
    await seedWaitlistEntry({ email: 'one@example.com', createdAt: NOW - DAY_MS });
    await seedWaitlistEntry({ email: 'two@example.com', locale: OwnerLocale.PortugueseBrazil, createdAt: NOW - DAY_MS });
    const posted = await postBatch({ path: INVITE_PATH, fields: emails('one@example.com', 'two@example.com') });
    const html = await posted.text();
    const digits = START_DISPLAY_NUMBER.replace('+', '');
    const links = [...html.matchAll(new RegExp(`https://wa\\.me/${digits}\\?text=[^"<\\s]+`, 'g'))].map((match) => match[0]);
    expect(posted.status).toBe(STATUS_OK);
    expect(new Set(links).size).toBe(2);
    const rows = await inviteRows();
    expect(rows.map((row) => row.email)).toEqual(['one@example.com', 'two@example.com']);
    links.forEach((link) => {
      const code = decodeURIComponent(link).match(/zbi_[a-z2-7]{24}/)?.[0];
      expect(code).toBeDefined();
      expect(JSON.stringify(rows)).not.toContain(code);
    });
    const [firstRow] = rows;
    expect(firstRow).toBeDefined();
    const expiry = await testEnv.CONNECTIONS.prepare('SELECT expires_at - created_at AS ttl FROM waitlist_invites').first<{
      ttl: number;
    }>();
    expect(expiry?.ttl).toBe(WAITLIST_INVITE_TTL_MS);
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([
      { outcome: BackofficeAuditOutcome.Succeeded, target_id: 'selected=2 issued=2 skipped=0' },
    ]);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AccessInviteLinksLabel }));
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AccessInviteDownload }));
  });

  test('skips an entry that already has a live invite, issues again after expiry and ignores an unknown email', async () => {
    await seedWaitlistEntry({ email: 'live@example.com', createdAt: NOW - DAY_MS });
    await seedWaitlistEntry({ email: 'expired@example.com', createdAt: NOW - DAY_MS });
    await seedInvite({ email: 'live@example.com', digest: 'd1', createdAt: NOW - HOUR, expiresAt: NOW + DAY_MS });
    await seedInvite({ email: 'expired@example.com', digest: 'd3', createdAt: NOW - 40 * DAY_MS, expiresAt: NOW - DAY_MS });
    const html = await (
      await postBatch({ path: INVITE_PATH, fields: emails('live@example.com', 'expired@example.com', 'ghost@example.com') })
    ).text();
    expect(html).toContain('data-count="issued">1<');
    expect(html).toContain('data-count="skipped">2<');
    expect((await inviteRows()).map((row) => row.email)).toEqual(['live@example.com', 'expired@example.com', 'expired@example.com']);
  });

  test('refuses the batch without an active number for the link and creates no code', async () => {
    await seedWaitlistEntry({ email: 'one@example.com', createdAt: NOW - DAY_MS });
    await testEnv.CONNECTIONS.prepare("UPDATE whatsapp_numbers SET state = 'disabled'").run();
    const posted = await postBatch({ path: INVITE_PATH, fields: emails('one@example.com') });
    const followed = await followRedirect({ posted, sessionToken });
    expect(followed.status).toBe(STATUS_UNPROCESSABLE);
    expect(await followed.text()).toContain(copyHtml({ key: BackofficeCopyKey.AccessNoStartNumber }));
    expect(await inviteRows()).toEqual([]);
  });

  test('refuses an empty selection, one above the limit, a wrong code and another origin', async () => {
    await seedWaitlistEntry({ email: 'one@example.com', createdAt: NOW - DAY_MS });
    const empty = await followRedirect({ posted: await postBatch({ path: INVITE_PATH, fields: [] }), sessionToken });
    expect(empty.status).toBe(STATUS_UNPROCESSABLE);
    const tooMany = await followRedirect({
      posted: await postBatch({
        path: INVITE_PATH,
        fields: emails(...Array.from({ length: ACCESS_BATCH_LIMIT + 1 }, (_, index) => `p${index}@example.com`)),
      }),
      sessionToken,
    });
    expect(tooMany.status).toBe(STATUS_UNPROCESSABLE);
    const wrongCode = await followRedirect({
      posted: await postBatch({ path: INVITE_PATH, fields: emails('one@example.com'), code: '000000' }),
      sessionToken,
    });
    expect(wrongCode.status).toBe(STATUS_UNAUTHORIZED);
    expect((await postBatch({ path: INVITE_PATH, fields: emails('one@example.com'), origin: 'https://evil.example' })).status).toBe(
      STATUS_FORBIDDEN,
    );
    expect(await inviteRows()).toEqual([]);
  });

  test('downloads the batch as a CSV with formula cells neutralised', async () => {
    const response = await postBatch({
      path: CSV_PATH,
      fields: [['links', 'one@example.com,https://wa.me/1?text=a\n=cmd@example.com,https://wa.me/1?text=b']],
    });
    const body = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('zapbip-invites-2026-11-07.csv');
    expect(body.split('\n')[0]).toBe('email,link');
    expect(body).toContain('"\'=cmd@example.com"');
  });

  test('reads a CSV posted with Windows line breaks as separate rows', async () => {
    const response = await postBatch({
      path: CSV_PATH,
      fields: [['links', 'one@example.com,https://wa.me/1?text=a\r\ntwo@example.com,https://wa.me/1?text=b\r\n']],
    });
    const lines = (await response.text()).split('\n').filter((line) => line.length > 0);
    expect(lines).toEqual(['email,link', '"one@example.com","https://wa.me/1?text=a"', '"two@example.com","https://wa.me/1?text=b"']);
  });
});

function failingDatabaseEnv(input: { failsOn: (sql: string) => boolean }) {
  const database = testEnv.CONNECTIONS;
  const proxy = new Proxy(database, {
    get(target, property) {
      const member: unknown = Reflect.get(target, property);
      if (property === 'prepare')
        return (sql: string) => {
          if (input.failsOn(sql)) throw new Error('the database refused the statement');
          return target.prepare(sql);
        };
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
  return backofficeEnv({ overrides: { CONNECTIONS: proxy } });
}

describe('a batch that meets a failure', () => {
  test('counts the account whose release failed, finishes the batch and audits it', async () => {
    await seedTwoWaiting();
    const env = failingDatabaseEnv({ failsOn: (sql) => sql.startsWith('UPDATE accounts SET state') });
    const response = await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first', 'acct_second'), env });
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html).toContain('data-count="itemFailed">2<');
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([
      {
        outcome: BackofficeAuditOutcome.Succeeded,
        target_id: 'selected=2 released=0 alreadyActive=0 notReleasable=0 sent=0 queued=0 failed=0 itemFailed=2',
      },
    ]);
  });

  test('issues no invite and audits a failed batch when the invite insert fails', async () => {
    await seedWaitlistEntry({ email: 'one@example.com', createdAt: NOW - DAY_MS });
    await testEnv.CONNECTIONS.prepare('ALTER TABLE waitlist_invites RENAME TO waitlist_invites_gone').run();
    try {
      const response = await postBatch({ path: INVITE_PATH, fields: emails('one@example.com') });
      expect(response.status).toBe(500);
      expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([
        { outcome: BackofficeAuditOutcome.Failed, target_id: 'selected=1 itemFailed=1' },
      ]);
    } finally {
      await testEnv.CONNECTIONS.prepare('ALTER TABLE waitlist_invites_gone RENAME TO waitlist_invites').run();
    }
    expect(await inviteRows()).toEqual([]);
  });
});

describe('what a batch leaves behind', () => {
  test('keeps codes and full phone numbers out of the audit rows, the flash and the logs', async () => {
    await seedTwoWaiting();
    await seedWaitlistEntry({ email: 'one@example.com', createdAt: NOW - DAY_MS });
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first', 'acct_second') });
    const invited = await (await postBatch({ path: INVITE_PATH, fields: emails('one@example.com') })).text();
    await postBatch({ path: RELEASE_PATH, fields: [] });
    const flash = await testEnv.CONNECTIONS.prepare('SELECT flash FROM backoffice_sessions').all<{ flash: string | null }>();
    const audit = await testEnv.CONNECTIONS.prepare('SELECT target_id, client_address FROM backoffice_audit').all<
      Record<string, string | null>
    >();
    const code = invited.match(/zbi_[a-z2-7]{24}/)?.[0];
    expect(code).toBeDefined();
    const leaks = [JSON.stringify(flash.results), JSON.stringify(audit.results), lines.join('\n')].join('\n');
    expect(leaks).not.toContain('zbi_');
    expect(leaks).not.toContain(FIRST_PHONE);
    expect(leaks).not.toContain(SECOND_PHONE);
  });

  test('logs a notice that failed with the account id only', async () => {
    await seedTwoWaiting();
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    const namespace = testEnv.ACCOUNT_INBOX;
    const failing = {
      idFromName: namespace.idFromName.bind(namespace),
      get: () => ({ noticeAccessOpened: () => Promise.reject(new Error('down')) }),
    };
    const env = backofficeEnv({ overrides: { ACCOUNT_INBOX: failing as unknown as typeof namespace } });
    await postBatch({ path: RELEASE_PATH, fields: accounts('acct_first'), env });
    const events = lines.filter((line) => line.includes('access_notice_failed')).map((line) => JSON.parse(line));
    expect(events).toEqual([{ event: 'access_notice_failed', accountId: 'acct_first' }]);
    expect(lines.join('\n')).not.toContain(FIRST_PHONE);
  });
});
