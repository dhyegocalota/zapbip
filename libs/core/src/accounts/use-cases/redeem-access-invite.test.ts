import { AccountState, DAY_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { INVITE_CODE_PREFIX, INVITE_CODE_RANDOM_LENGTH } from '../constants';
import { createInMemoryAccountDependencies } from '../testing/in-memory-accounts';
import { redeemAccessInvite } from './redeem-access-invite';

const NOW = 10 * DAY_MS;
const CODE = `${INVITE_CODE_PREFIX}${'k'.repeat(INVITE_CODE_RANDOM_LENGTH)}`;
const TEXT = `Hello, my invite is ${CODE}`;

async function setup(input: { state: AccountState; expiresAt?: number }) {
  const { expiresAt = NOW + DAY_MS } = input;
  const environment = createInMemoryAccountDependencies();
  const account = await environment.openAccount({ state: input.state });
  environment.access.invites.issue({ code: CODE, expiresAt });
  return { environment, account };
}

describe('redeemAccessInvite', () => {
  test('a valid code opens a waitlisted account', async () => {
    const { environment, account } = await setup({ state: AccountState.Waitlisted });
    const result = await redeemAccessInvite({ dependencies: environment.access, account, text: TEXT, now: NOW });
    expect(result.isRedeemed).toBe(true);
    expect(result.account.state).toBe(AccountState.Active);
  });

  test('a code works once', async () => {
    const { environment, account } = await setup({ state: AccountState.Waitlisted });
    await redeemAccessInvite({ dependencies: environment.access, account, text: TEXT, now: NOW });
    const other = await environment.openAccount({ waId: '5511888880000', state: AccountState.Waitlisted, accountId: 'acct_other' });
    const second = await redeemAccessInvite({ dependencies: environment.access, account: other, text: TEXT, now: NOW });
    expect(second.isRedeemed).toBe(false);
    expect(second.account.state).toBe(AccountState.Waitlisted);
  });

  test('an expired code changes nothing', async () => {
    const { environment, account } = await setup({ state: AccountState.Waitlisted, expiresAt: NOW });
    const result = await redeemAccessInvite({ dependencies: environment.access, account, text: TEXT, now: NOW });
    expect(result).toEqual({ account, isRedeemed: false });
  });

  test.each([null, 'no code here', `${INVITE_CODE_PREFIX}${'q'.repeat(INVITE_CODE_RANDOM_LENGTH)}`])(
    'text %s redeems nothing',
    async (text) => {
      const { environment, account } = await setup({ state: AccountState.Waitlisted });
      const result = await redeemAccessInvite({ dependencies: environment.access, account, text, now: NOW });
      expect(result.isRedeemed).toBe(false);
      expect(result.account.state).toBe(AccountState.Waitlisted);
    },
  );

  test.each([AccountState.Active, AccountState.Suspended, AccountState.Deleting])('a %s account never consumes the code', async (state) => {
    const { environment, account } = await setup({ state });
    await redeemAccessInvite({ dependencies: environment.access, account, text: TEXT, now: NOW });
    expect(await environment.access.invites.consume({ code: CODE, now: NOW })).toBe(true);
  });
});
