import { AccessReleaseOutcome, AccessNoticeOutcome, DeliveryState } from '@zapbip/types';
import { releaseAccountAccess, type AccountRecord } from '@zapbip/core';
import { D1AccountDirectory } from '../../adapters/d1/d1-account-directory';
import type { AccountOwnerRpc } from '../../contract/account-owner-rpc';
import type { Bindings } from '../../contract/env';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { accountInboxOf } from '../../routes/account-inbox-stub';
import type { BatchCounts } from './access-batch-counts';

export type ReleasedAccount = { accountId: string; waId: string | null; outcome: AccessReleaseOutcome; notice: AccessNoticeOutcome | null };

const NOTICE_BY_DELIVERY: Record<DeliveryState.Sent | DeliveryState.Queued, AccessNoticeOutcome> = {
  [DeliveryState.Sent]: AccessNoticeOutcome.Sent,
  [DeliveryState.Queued]: AccessNoticeOutcome.Queued,
};

async function noticeOf(input: { bindings: Bindings; account: AccountRecord }): Promise<AccessNoticeOutcome> {
  const { bindings, account } = input;
  try {
    const outcome = await accountInboxOf<AccountOwnerRpc>({ bindings, accountId: account.accountId }).noticeAccessOpened({
      account,
      appOrigin: bindings.APP_ORIGIN,
    });
    return outcome.ok ? NOTICE_BY_DELIVERY[outcome.value] : AccessNoticeOutcome.Failed;
  } catch {
    return AccessNoticeOutcome.Failed;
  }
}

async function releaseOne(input: { bindings: Bindings; accountId: string; now: number }): Promise<ReleasedAccount> {
  const { bindings, accountId, now } = input;
  const dependencies = { accounts: new D1AccountDirectory({ database: bindings.CONNECTIONS }) };
  const { outcome, account } = await releaseAccountAccess({ dependencies, accountId, releasedAt: now });
  const waId = account === null ? null : account.waId;
  if (outcome !== AccessReleaseOutcome.Released || account === null) return { accountId, waId, outcome, notice: null };
  const notice = await noticeOf({ bindings, account });
  if (notice === AccessNoticeOutcome.Failed) logEvent({ event: LogEvent.AccessNoticeFailed, accountId });
  return { accountId, waId, outcome, notice };
}

export function releaseBatch(input: { bindings: Bindings; accountIds: string[]; now: number }): Promise<ReleasedAccount[]> {
  const { bindings, accountIds, now } = input;
  return accountIds.reduce<Promise<ReleasedAccount[]>>(
    async (previous, accountId) => [...(await previous), await releaseOne({ bindings, accountId, now })],
    Promise.resolve([]),
  );
}

function countOf(input: { rows: ReleasedAccount[]; outcome: AccessReleaseOutcome }): number {
  return input.rows.filter((row) => row.outcome === input.outcome).length;
}

function noticeCountOf(input: { rows: ReleasedAccount[]; notice: AccessNoticeOutcome }): number {
  return input.rows.filter((row) => row.notice === input.notice).length;
}

export function releaseCountsOf(input: { rows: ReleasedAccount[] }): BatchCounts {
  const { rows } = input;
  return {
    selected: rows.length,
    released: countOf({ rows, outcome: AccessReleaseOutcome.Released }),
    alreadyActive: countOf({ rows, outcome: AccessReleaseOutcome.AlreadyActive }),
    notReleasable:
      countOf({ rows, outcome: AccessReleaseOutcome.NotWaitlisted }) + countOf({ rows, outcome: AccessReleaseOutcome.NotFound }),
    sent: noticeCountOf({ rows, notice: AccessNoticeOutcome.Sent }),
    queued: noticeCountOf({ rows, notice: AccessNoticeOutcome.Queued }),
    failed: noticeCountOf({ rows, notice: AccessNoticeOutcome.Failed }),
  };
}
