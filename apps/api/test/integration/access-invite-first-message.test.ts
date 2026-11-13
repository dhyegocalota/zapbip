import { AccountState, DAY_MS, WAITLIST_INVITE_TTL_MS } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountOwnerRpc } from '../../src/contract/account-owner-rpc';
import type { Bindings } from '../../src/contract/env';
import { LogEvent } from '../../src/contract/log';
import { D1AccessInvites } from '../../src/adapters/d1/d1-access-invites';
import { applyDirectoryMigration, seedAccount, seedOwnerIdentity } from '../support/seed';
import { seedWhatsAppNumber, TEST_NUMBER_ID } from '../support/whatsapp-numbers';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { OwnerLocale } from '@zapbip/types';
import { bindingsWith, deliver, findAccounts, screenTextsOf, WA_ID } from './owner-inbound-fixtures';

const EMAIL = 'invited@example.com';

function waitlistBindings() {
  return bindingsWith({ waitlistEnabled: true });
}

async function issueCode(input: { issuedAt?: number; email?: string } = {}): Promise<string> {
  const { issuedAt = Date.now(), email = EMAIL } = input;
  const [code] = await new D1AccessInvites({ database: testEnv.CONNECTIONS }).issueMany({ emails: [email], now: issuedAt });
  if (code === undefined || code === null) throw new Error('the invite was not issued');
  return code;
}

async function storedPayloads(input: { accountId: string }): Promise<string> {
  const rows = await runInDurableObject(accountInboxStub({ accountId: input.accountId }), (_instance, state) =>
    state.storage.sql.exec<{ payload: string }>('SELECT payload FROM inbox_messages').toArray(),
  );
  return rows.map((row) => row.payload).join('\n');
}

function namespaceFailingToReceive(input: { onNotice: () => void }): Bindings['ACCOUNT_INBOX'] {
  const namespace = testEnv.ACCOUNT_INBOX;
  const get = (id: DurableObjectId) => ({
    receiveAccountMessage: () => Promise.reject(new Error('the object is down')),
    noticeAccessOpened: (request: Parameters<AccountOwnerRpc['noticeAccessOpened']>[0]) => {
      input.onNotice();
      return namespace.get(id).noticeAccessOpened(request);
    },
  });
  return { idFromName: namespace.idFromName.bind(namespace), get } as unknown as Bindings['ACCOUNT_INBOX'];
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
afterEach(() => {
  vi.restoreAllMocks();
  return reset();
});

describe('the first message with an invite code', () => {
  it('opens a new account active, consumes the code and sends the access message', async () => {
    const code = await issueCode();
    await deliver({ bindings: waitlistBindings(), text: `Hi! My invite: ${code}` });
    const account = await onlyAccount();
    expect(account.state).toBe(AccountState.Active);
    expect(await usedAtOf()).not.toBeNull();
    expect((await screenTextsOf({ accountId: account.accountId })).join('\n')).toContain('Envie "novo agente <nome>"');
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
    await deliver({ bindings: waitlistBindings(), text: 'zbi_222222222222222222222222' });
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

  it('keeps the code out of the stored message', async () => {
    const code = await issueCode();
    await deliver({ bindings: waitlistBindings(), text: `Hi! My invite: ${code}` });
    const stored = await storedPayloads({ accountId: (await onlyAccount()).accountId });
    expect(stored).toContain('Hi! My invite:');
    expect(stored.toLowerCase()).not.toContain(code);
  });

  it('keeps a live code out of the stored message of an active account and leaves it unused', async () => {
    const code = await issueCode();
    await deliver({ bindings: bindingsWith({ waitlistEnabled: false }), text: `my invite ${code}` });
    const stored = await storedPayloads({ accountId: (await onlyAccount()).accountId });
    expect(stored).toContain('my invite');
    expect(stored.toLowerCase()).not.toContain(code);
    expect(await usedAtOf()).toBeNull();
  });

  it('spends only the first of two codes sent by the same phone', async () => {
    const first = await issueCode();
    const second = await issueCode({ email: 'other@example.com' });
    await deliver({ bindings: waitlistBindings(), text: first });
    await deliver({ bindings: waitlistBindings(), text: second });
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT used_at FROM waitlist_invites ORDER BY rowid').all<{
      used_at: number | null;
    }>();
    expect(results.filter((row) => row.used_at !== null)).toHaveLength(1);
  });

  it('sends the access notice even when the object fails to receive the message', async () => {
    const code = await issueCode();
    let notices = 0;
    const bindings = { ...waitlistBindings(), ACCOUNT_INBOX: namespaceFailingToReceive({ onNotice: () => (notices += 1) }) };
    await expect(deliver({ bindings, text: code })).rejects.toThrow('the object is down');
    expect(notices).toBe(1);
    expect((await onlyAccount()).state).toBe(AccountState.Active);
  });

  it('logs the redemption with the account id only', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    const code = await issueCode();
    await deliver({ bindings: waitlistBindings(), text: code });
    const account = await onlyAccount();
    const redeemed = lines.filter((line) => line.includes(LogEvent.AccessInviteRedeemed));
    expect(redeemed.map((line) => JSON.parse(line))).toEqual([{ event: LogEvent.AccessInviteRedeemed, accountId: account.accountId }]);
    expect(lines.join('\n').toLowerCase()).not.toContain(code);
    expect(lines.join('\n')).not.toContain(WA_ID);
  });
});
