import { finishAccountDeletion, openOwnerAccount, type ChannelInboundEntry, type ReceiveResult } from '@zapbip/core';
import { AccountState, SenderVerdict, type OwnerLocale } from '@zapbip/types';
import { lifecycleDependenciesOf, inboxPurgeOf } from '../accounts/deletion-sweep';
import { createSenderGuard } from '../adapters/guard/sender-guard';
import { createPlatformClock } from '../adapters/platform/clock';
import { readWaitlistEnabled } from '../config/waitlist-enabled';
import type { AccountOwnerRpc } from '../contract/account-owner-rpc';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { accountInboxOf } from '../routes/account-inbox-stub';

export type OwnerInboundEntryRequest = { accountId: string; ownerLocale: OwnerLocale; downloadsMedia: boolean };

export type OwnerInboundInput = {
  bindings: Bindings;
  waId: string;
  channelMessageId: string;
  entryOf: (input: OwnerInboundEntryRequest) => Promise<ChannelInboundEntry>;
};

const DROPPED_RESULT: ReceiveResult = { messageId: null, agent: null, duplicate: false };

async function finishDeletion(input: { bindings: Bindings; accountId: string }): Promise<void> {
  const { bindings, accountId } = input;
  await finishAccountDeletion({
    dependencies: lifecycleDependenciesOf({ environment: bindings }),
    accountId,
    inboxPurge: inboxPurgeOf({ environment: bindings, accountId }),
  });
  logEvent({ event: LogEvent.AccountDeleted, accountId });
}

async function admitSender(input: { bindings: Bindings; waId: string }): Promise<boolean> {
  const { bindings, waId } = input;
  const verdict = await createSenderGuard({ database: bindings.CONNECTIONS, limiter: bindings.OWNER_RATE_LIMITER }).admit({ waId });
  if (verdict === SenderVerdict.Blocked) logEvent({ event: LogEvent.SenderBlocked });
  if (verdict === SenderVerdict.RateLimited) logEvent({ event: LogEvent.SenderRateLimited });
  return verdict === SenderVerdict.Admitted;
}

export async function receiveOwnerInbound(input: OwnerInboundInput): Promise<ReceiveResult> {
  const { bindings, waId, channelMessageId, entryOf } = input;
  const isAdmitted = await admitSender({ bindings, waId });
  if (!isAdmitted) return DROPPED_RESULT;
  const lookup = await openOwnerAccount({
    dependencies: lifecycleDependenciesOf({ environment: bindings }),
    waId,
    waitlistEnabled: readWaitlistEnabled({ bindings }),
    createdAt: createPlatformClock().now(),
  });
  if (lookup === null) {
    logEvent({ event: LogEvent.AccountDailyCap });
    return DROPPED_RESULT;
  }
  const { account, created } = lookup;
  if (created) logEvent({ event: LogEvent.AccountCreated, accountId: account.accountId, locale: account.locale });
  if (account.state === AccountState.Deleting) {
    await finishDeletion({ bindings, accountId: account.accountId });
    return DROPPED_RESULT;
  }
  const downloadsMedia = !created && account.state === AccountState.Active;
  const entry = await entryOf({ accountId: account.accountId, ownerLocale: account.locale, downloadsMedia });
  const outcome = await accountInboxOf<AccountOwnerRpc>({ bindings, accountId: account.accountId }).receiveAccountMessage({
    account,
    channelMessageId,
    entry,
    publicOrigin: bindings.PUBLIC_ORIGIN,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  if (outcome.value.deletionConfirmed) await finishDeletion({ bindings, accountId: account.accountId });
  return outcome.value;
}
