import { AccountState, OwnerLocale, WaitlistSource } from '@zapbip/types';
import { TEST_NUMBER_ID } from './whatsapp-numbers';
import { testEnv } from './workers-env';

export type WaitingAccountSeed = {
  accountId: string;
  phone: string;
  locale?: OwnerLocale;
  state?: AccountState;
  createdAt: number;
};

export async function seedWaitingAccount(input: WaitingAccountSeed): Promise<void> {
  const { accountId, phone, locale = OwnerLocale.EnglishUs, state = AccountState.Waitlisted, createdAt } = input;
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('INSERT INTO accounts (id, state, created_at, number_id) VALUES (?, ?, ?, ?)').bind(
      accountId,
      state,
      createdAt,
      TEST_NUMBER_ID,
    ),
    testEnv.CONNECTIONS.prepare(
      'INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (?, ?, NULL, ?, ?)',
    ).bind(phone, accountId, locale, createdAt),
  ]);
}

export async function seedWaitlistEntry(input: {
  email: string;
  locale?: OwnerLocale;
  source?: WaitlistSource;
  createdAt: number;
}): Promise<void> {
  const { email, locale = OwnerLocale.EnglishUs, source = WaitlistSource.Form, createdAt } = input;
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO landing_waitlist (email, locale, referral_code, referred_by, credited, created_at, source) VALUES (?, ?, ?, NULL, 0, ?, ?)',
  )
    .bind(email, locale, `code-${email}`, createdAt, source)
    .run();
}

export async function seedInvite(input: {
  email: string;
  digest: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number | null;
}): Promise<void> {
  const { email, digest, createdAt, expiresAt, usedAt = null } = input;
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO waitlist_invites (code_digest, email, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(digest, email, createdAt, expiresAt, usedAt)
    .run();
}

export async function stateOfAccount(input: { accountId: string }): Promise<string> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT state FROM accounts WHERE id = ?').bind(input.accountId).first<{ state: string }>();
  if (row === null) throw new Error(`no account ${input.accountId}`);
  return row.state;
}
