import { AccountState, DAY_MS, WAITLIST_INVITE_TTL_MS } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D1AccessInvites } from '../../src/adapters/d1/d1-access-invites';
import { applyDirectoryMigration, seedAccount, seedOwnerIdentity } from '../support/seed';
import { seedWhatsAppNumber, TEST_NUMBER_ID } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { OwnerLocale } from '@zapbip/types';
import { bindingsWith, deliver, findAccounts, screenTextsOf, WA_ID } from './owner-inbound-fixtures';

const EMAIL = 'invited@example.com';

function waitlistBindings() {
  return bindingsWith({ waitlistEnabled: true });
}

async function issueCode(input: { issuedAt?: number } = {}): Promise<string> {
  const { issuedAt = Date.now() } = input;
  return new D1AccessInvites({ database: testEnv.CONNECTIONS }).issue({ email: EMAIL, now: issuedAt });
}

async function usedAtOf(): Promise<number | null> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT used_at FROM waitlist_invites').first<{ used_at: number | null }>();
  return row === null ? null : row.used_at;
}

async function onlyAccount() {
  const [account] = await findAccounts({ waId: WA_ID });
  if (account === undefined) throw new Error('the account is missing');
  return account;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedWhatsAppNumber();
});
afterEach(() => reset());

describe('the first message with an invite code', () => {
  it('opens a new account active, consumes the code and sends the access message', async () => {
    const code = await issueCode();
    await deliver({ bindings: waitlistBindings(), text: `Hi! My invite: ${code}` });
    const account = await onlyAccount();
    expect(account.state).toBe(AccountState.Active);
    expect(await usedAtOf()).not.toBeNull();
    expect((await screenTextsOf({ accountId: account.accountId })).join('\n')).toContain('Send "novo agente <nome>"');
  });

  it('releases an existing waitlisted account of that phone', async () => {
    await seedOwnerIdentity({ accountId: 'acct_waiting', phone: WA_ID, ownerLocale: OwnerLocale.EnglishUs, numberId: TEST_NUMBER_ID });
    await testEnv.CONNECTIONS.prepare("UPDATE accounts SET state = 'waitlisted' WHERE id = 'acct_waiting'").run();
    const code = await issueCode();
    await deliver({ bindings: waitlistBindings(), text: code });
    expect((await onlyAccount()).state).toBe(AccountState.Active);
  });

  it('a used code changes nothing for the second phone', async () => {
    const code = await issueCode();
    await deliver({ bindings: waitlistBindings(), text: code });
    await deliver({ bindings: waitlistBindings(), text: code, waId: '5511900000077' });
    const [second] = await findAccounts({ waId: '5511900000077' });
    expect(second?.state).toBe(AccountState.Waitlisted);
  });

  it('an expired code changes nothing', async () => {
    const code = await issueCode({ issuedAt: Date.now() - WAITLIST_INVITE_TTL_MS - DAY_MS });
    await deliver({ bindings: waitlistBindings(), text: code });
    expect((await onlyAccount()).state).toBe(AccountState.Waitlisted);
    expect(await usedAtOf()).toBeNull();
  });

  it('an unknown code changes nothing and the message is handled as any other', async () => {
    await deliver({ bindings: waitlistBindings(), text: 'zbi_000000000000000000000000' });
    expect((await onlyAccount()).state).toBe(AccountState.Waitlisted);
  });

  it.each([AccountState.Suspended, AccountState.Active])('a %s account never consumes the code', async (state) => {
    await seedOwnerIdentity({ accountId: 'acct_other', phone: WA_ID, ownerLocale: OwnerLocale.EnglishUs, numberId: TEST_NUMBER_ID });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(state, 'acct_other').run();
    const code = await issueCode();
    await deliver({ bindings: waitlistBindings(), text: code });
    expect((await onlyAccount()).state).toBe(state);
    expect(await usedAtOf()).toBeNull();
  });

  it('with the waitlist off the account opens active and keeps the code unused', async () => {
    const code = await issueCode();
    await deliver({ bindings: bindingsWith({ waitlistEnabled: false }), text: code });
    expect((await onlyAccount()).state).toBe(AccountState.Active);
    expect(await usedAtOf()).toBeNull();
  });
});
