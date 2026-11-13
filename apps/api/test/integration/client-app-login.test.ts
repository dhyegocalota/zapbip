import { AccountState, ChannelInboundKind, HttpStatus, MessageKind, OwnerLocale, SIGN_IN_LINK_TTL_MS } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import { sha256Hex } from '../../src/adapters/platform/hash';
import { SEE_OTHER_STATUS } from '../../src/backoffice/backoffice-constants';
import { csrfTokenOf } from '../../src/client-app/csrf';
import { clientAppFetch } from '../support/client-app';
import { readScreen } from '../support/inbox-session';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';

const ACCOUNT = 'acc_client_app_login';
const OWNER_PHONE = '5511900000042';
const TOKEN_PATTERN = /\/sign-in\/([A-Za-z0-9_-]{43})/;
const TOKEN_ROWS_STATEMENT =
  'SELECT token_digest AS tokenDigest, account_id AS accountId, expires_at AS expiresAt FROM client_app_sign_in_tokens';

type TokenRow = { tokenDigest: string; accountId: string; expiresAt: number };

function receive(input: { text: string; channelMessageId: string; locale?: OwnerLocale }) {
  return accountInboxStub({ accountId: ACCOUNT }).receiveAccountMessage({
    account: {
      accountId: ACCOUNT,
      waId: OWNER_PHONE,
      state: AccountState.Active,
      locale: input.locale === undefined ? OwnerLocale.EnglishUs : input.locale,
    },
    channelMessageId: input.channelMessageId,
    entry: {
      kind: ChannelInboundKind.Owner,
      at: Date.now(),
      replyToChannelMessageId: null,
      forwarded: false,
      content: { kind: MessageKind.Text, text: input.text },
      noticeText: null,
    },
    publicOrigin: testEnv.PUBLIC_ORIGIN,
    appOrigin: testEnv.APP_ORIGIN,
  });
}

async function screenText(): Promise<string> {
  const entries = await readScreen({ stub: accountInboxStub({ accountId: ACCOUNT }) });
  return entries.map((entry) => entry.text).join('\n');
}

async function tokenRows(): Promise<TokenRow[]> {
  return (await testEnv.CONNECTIONS.prepare(TOKEN_ROWS_STATEMENT).all<TokenRow>()).results;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedOwnerIdentity({ accountId: ACCOUNT, phone: OWNER_PHONE, ownerLocale: OwnerLocale.EnglishUs });
});
afterEach(reset);

describe('the login command through the account object', () => {
  it('replies with a link on the app origin and stores only the digest of its token', async () => {
    const before = Date.now();
    await receive({ text: 'login', channelMessageId: 'wamid.login.one' });
    const token = TOKEN_PATTERN.exec(await screenText())![1]!;
    const [row] = await tokenRows();
    expect(row!.tokenDigest).toBe(await sha256Hex({ value: token }));
    expect(row!.accountId).toBe(ACCOUNT);
    expect(row!.expiresAt).toBeGreaterThanOrEqual(before + SIGN_IN_LINK_TTL_MS);
    expect(await screenText()).toContain(`${testEnv.APP_ORIGIN}/sign-in/`);
  });

  it('answers a Portuguese owner on the pt-br path', async () => {
    await receive({ text: 'entrar', channelMessageId: 'wamid.login.pt', locale: OwnerLocale.PortugueseBrazil });
    expect(await screenText()).toContain(`${testEnv.APP_ORIGIN}/pt-br/sign-in/`);
  });

  it('keeps one live token per account: a second login replaces the first', async () => {
    await receive({ text: 'login', channelMessageId: 'wamid.login.first' });
    await receive({ text: 'login', channelMessageId: 'wamid.login.second' });
    const [firstToken, secondToken] = [...(await screenText()).matchAll(new RegExp(TOKEN_PATTERN, 'g'))].map((match) => match[1]!);
    expect(await tokenRows()).toHaveLength(1);
    const signInWith = async (token: string) =>
      clientAppFetch({ path: `/sign-in/${token}`, method: 'POST', form: { csrf: await csrfTokenOf({ secret: token }) } });
    expect((await signInWith(firstToken!)).status).toBe(HttpStatus.Gone);
    expect((await signInWith(secondToken!)).status).toBe(SEE_OTHER_STATUS);
  });

  it('keeps no clear token in the stored message log', async () => {
    await receive({ text: 'login', channelMessageId: 'wamid.login.mask' });
    expect(await screenText()).toMatch(TOKEN_PATTERN);
    const stored = await runInDurableObject(accountInboxStub({ accountId: ACCOUNT }), (_instance: AccountInbox, state) =>
      state.storage.sql
        .exec<{ payload: string }>('SELECT payload FROM inbox_messages')
        .toArray()
        .map((row) => row.payload)
        .join('\n'),
    );
    expect(stored).toContain('/sign-in/');
    expect(stored).not.toMatch(TOKEN_PATTERN);
  });
});
