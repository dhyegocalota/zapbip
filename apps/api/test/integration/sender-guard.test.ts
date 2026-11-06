import { ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE, OUTBOUND_MESSAGES_PER_MINUTE, OWNER_MESSAGES_PER_MINUTE } from '@zapbip/core';
import { SenderVerdict } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { createOutboundGuard } from '../../src/adapters/guard/outbound-guard';
import { createSenderGuard } from '../../src/adapters/guard/sender-guard';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { applyDirectoryMigration, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

const WA_ID = '5511900000000';
const OTHER_WA_ID = '5511900000001';
const ACCOUNT_ID = 'acc_1';
const ADMITTED_BEFORE_BLOCK = 5;
const CONNECTIONS_PER_ACCOUNT = 4;

function senderGuard(input: { limit: number }) {
  const limiter = createFakeRateLimiter(input);
  return { limiter, guard: createSenderGuard({ database: testEnv.CONNECTIONS, limiter }) };
}

async function block(input: { waId: string }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('INSERT INTO blocked_phones (wa_id, reason, created_at) VALUES (?, ?, ?)')
    .bind(input.waId, 'abuse', SEED_CREATED_AT)
    .run();
}

async function admitMany(input: { count: number; admit: () => Promise<SenderVerdict> }): Promise<SenderVerdict[]> {
  return Array.from({ length: input.count }).reduce<Promise<SenderVerdict[]>>(
    async (verdicts) => [...(await verdicts), await input.admit()],
    Promise.resolve([]),
  );
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('sender guard', () => {
  it('drops a blocked phone without calling the limiter', async () => {
    await block({ waId: WA_ID });
    const { guard, limiter } = senderGuard({ limit: OWNER_MESSAGES_PER_MINUTE });
    expect(await guard.admit({ waId: WA_ID })).toBe(SenderVerdict.Blocked);
    expect(limiter.calls).toEqual([]);
  });

  it('admits a phone that is not listed while the limiter passes', async () => {
    const { guard } = senderGuard({ limit: OWNER_MESSAGES_PER_MINUTE });
    expect(await guard.admit({ waId: WA_ID })).toBe(SenderVerdict.Admitted);
  });

  it('rate limits when the limiter fails', async () => {
    const { guard } = senderGuard({ limit: 0 });
    expect(await guard.admit({ waId: WA_ID })).toBe(SenderVerdict.RateLimited);
  });

  it('admits the first twenty calls and limits the twenty-first', async () => {
    const { guard } = senderGuard({ limit: OWNER_MESSAGES_PER_MINUTE });
    const verdicts = await admitMany({ count: OWNER_MESSAGES_PER_MINUTE + 1, admit: () => guard.admit({ waId: WA_ID }) });
    expect(verdicts.slice(0, OWNER_MESSAGES_PER_MINUTE).every((verdict) => verdict === SenderVerdict.Admitted)).toBe(true);
    expect(verdicts[OWNER_MESSAGES_PER_MINUTE]).toBe(SenderVerdict.RateLimited);
  });

  it('reads the blocklist on every call', async () => {
    const { guard } = senderGuard({ limit: OWNER_MESSAGES_PER_MINUTE });
    await admitMany({ count: ADMITTED_BEFORE_BLOCK, admit: () => guard.admit({ waId: WA_ID }) });
    await block({ waId: WA_ID });
    expect(await guard.admit({ waId: WA_ID })).toBe(SenderVerdict.Blocked);
    expect(await guard.admit({ waId: OTHER_WA_ID })).toBe(SenderVerdict.Admitted);
  });
});

describe('outbound guard', () => {
  function outboundGuard() {
    return createOutboundGuard({
      connectionLimiter: createFakeRateLimiter({ limit: OUTBOUND_MESSAGES_PER_MINUTE }),
      accountLimiter: createFakeRateLimiter({ limit: ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE }),
    });
  }

  it('limits the thirty-first call of one connection and admits another connection of the account', async () => {
    const guard = outboundGuard();
    const verdicts = await admitMany({
      count: OUTBOUND_MESSAGES_PER_MINUTE + 1,
      admit: () => guard.admit({ accountId: ACCOUNT_ID, connectionId: 'con_1' }),
    });
    expect(verdicts.slice(0, OUTBOUND_MESSAGES_PER_MINUTE).every((verdict) => verdict === SenderVerdict.Admitted)).toBe(true);
    expect(verdicts[OUTBOUND_MESSAGES_PER_MINUTE]).toBe(SenderVerdict.RateLimited);
    expect(await guard.admit({ accountId: ACCOUNT_ID, connectionId: 'con_2' })).toBe(SenderVerdict.Admitted);
  });

  it('limits the account at its own total across connections and admits another account', async () => {
    const guard = outboundGuard();
    const connectionIds = Array.from({ length: CONNECTIONS_PER_ACCOUNT }, (_, index) => `con_${index}`);
    const perConnection = ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE / (CONNECTIONS_PER_ACCOUNT - 1);
    const admitted = await Promise.all(
      connectionIds
        .slice(0, CONNECTIONS_PER_ACCOUNT - 1)
        .map((connectionId) => admitMany({ count: perConnection, admit: () => guard.admit({ accountId: ACCOUNT_ID, connectionId }) })),
    );
    expect(admitted.flat().every((verdict) => verdict === SenderVerdict.Admitted)).toBe(true);
    expect(await guard.admit({ accountId: ACCOUNT_ID, connectionId: `con_${CONNECTIONS_PER_ACCOUNT - 1}` })).toBe(
      SenderVerdict.RateLimited,
    );
    expect(await guard.admit({ accountId: 'acc_2', connectionId: 'con_other' })).toBe(SenderVerdict.Admitted);
  });
});
