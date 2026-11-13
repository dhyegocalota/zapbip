import { AccountPlan, AccountState, PRICING_FREE_MESSAGES } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { buildAccountOverview } from './account-overview';
import type { ConnectionRecord } from './account-types';
import { NO_INSTALL_CODE } from './constants';

const CREATED_AT = 1_700_000_000_000;
const LAST_SEEN_AT = 1_700_000_500_000;

function connectionOf(input: { agent: string; clientName: string | null }): ConnectionRecord {
  return {
    connectionId: `con_${input.agent}`,
    accountId: 'acc_1',
    agent: input.agent,
    secretDigest: `digest_${input.agent}`,
    clientName: input.clientName,
    firstCallAt: null,
    createdAt: CREATED_AT,
    ...NO_INSTALL_CODE,
  };
}

describe('buildAccountOverview', () => {
  test('joins each connection with its last activity and leaves the unseen one null', () => {
    const overview = buildAccountOverview({
      account: { state: AccountState.Active, waId: '5511900000051' },
      connections: [connectionOf({ agent: 'alpha', clientName: 'Claude Code' }), connectionOf({ agent: 'beta', clientName: null })],
      activity: [{ agent: 'alpha', lastSeenAt: LAST_SEEN_AT }],
    });
    expect(overview.agents).toEqual([
      { agent: 'alpha', clientName: 'Claude Code', createdAt: CREATED_AT, lastSeenAt: LAST_SEEN_AT },
      { agent: 'beta', clientName: null, createdAt: CREATED_AT, lastSeenAt: null },
    ]);
  });

  test('masks the phone and states the free plan with its allowance', () => {
    const overview = buildAccountOverview({
      account: { state: AccountState.Waitlisted, waId: '5511900000051' },
      connections: [],
      activity: [],
    });
    expect(overview).toEqual({
      state: AccountState.Waitlisted,
      phone: '••••-0051',
      plan: AccountPlan.Free,
      freeMessages: PRICING_FREE_MESSAGES,
      agents: [],
    });
  });
});
