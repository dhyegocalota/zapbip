import {
  fillCopyTokens,
  finishAccountDeletion,
  openOwnerAccount,
  redeemAccessInvite,
  ownerLocaleOf,
  type AccountRecord,
  type ChannelInboundEntry,
  type OwnerAccountContext,
  type ReceiveResult,
} from '@zapbip/core';
import { AccountState, MessageKind, ChannelInboundKind, SenderVerdict, WhatsAppNumberState, type OwnerLocale } from '@zapbip/types';
import { lifecycleDependenciesOf, inboxPurgeOf } from '../accounts/deletion-sweep';
import { D1AccessInvites } from '../adapters/d1/d1-access-invites';
import { numberRegistryOf } from '../adapters/d1/d1-number-registry';
import { createSenderGuard } from '../adapters/guard/sender-guard';
import { OperatorEvent } from '../adapters/whatsapp/whatsapp-enums';
import { logOperatorEvent } from '../adapters/whatsapp/operator-log';
import { OwnerCopyKey, WHATSAPP_COPY } from '../adapters/whatsapp/whatsapp-copy';
import { createPlatformClock } from '../adapters/platform/clock';
import { readWaitlistEnabled } from '../config/waitlist-enabled';
import type { AccountOwnerRpc } from '../contract/account-owner-rpc';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { sendNumberNotice } from '../numbers/number-notice';
import type { RegisteredNumber } from '../numbers/number-registry';
import { accountInboxOf } from '../routes/account-inbox-stub';

export type OwnerInboundEntryRequest = { accountId: string; ownerLocale: OwnerLocale; downloadsMedia: boolean };

export type OwnerInboundInput = {
  bindings: Bindings;
  number: RegisteredNumber;
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

function inviteTextOf(input: { entry: ChannelInboundEntry }): string | null {
  const { entry } = input;
  if (entry.kind !== ChannelInboundKind.Owner || entry.content.kind !== MessageKind.Text) return null;
  return entry.content.text;
}

async function noticeRedeemedAccess(input: {
  accountInbox: AccountOwnerRpc;
  account: OwnerAccountContext;
  appOrigin: string;
}): Promise<void> {
  const { accountInbox, account, appOrigin } = input;
  logEvent({ event: LogEvent.AccessInviteRedeemed, accountId: account.accountId });
  const notice = await accountInbox.noticeAccessOpened({ account, appOrigin });
  if (!notice.ok) logEvent({ event: LogEvent.AccessNoticeFailed, accountId: account.accountId });
}

async function refuseNewAccount(input: OwnerInboundInput): Promise<ReceiveResult> {
  const { bindings, number, waId } = input;
  logOperatorEvent({ event: OperatorEvent.InboundNumberClosed, fields: {} });
  const text = WHATSAPP_COPY[ownerLocaleOf({ waId })][OwnerCopyKey.NumberClosedToNewAccounts];
  await sendNumberNotice({ bindings, registry: numberRegistryOf({ bindings }), numberId: number.numberId, waId, text });
  return DROPPED_RESULT;
}

async function refuseOtherNumber(input: { bindings: Bindings; number: RegisteredNumber; account: AccountRecord }): Promise<ReceiveResult> {
  const { bindings, number, account } = input;
  logOperatorEvent({ event: OperatorEvent.InboundAccountOnOtherNumber, fields: {} });
  const registry = numberRegistryOf({ bindings });
  if (account.homeNumberId === null) {
    logOperatorEvent({ event: OperatorEvent.InboundAccountWithoutNumber, fields: {} });
    return DROPPED_RESULT;
  }
  const home = await registry.findNumber({ numberId: account.homeNumberId });
  if (home === null) throw new Error(`account ${account.accountId} has no home number`);
  const text = fillCopyTokens({
    text: WHATSAPP_COPY[account.locale][OwnerCopyKey.AccountOnOtherNumber],
    values: { displayNumber: home.displayNumber },
  });
  await sendNumberNotice({ bindings, registry, numberId: number.numberId, waId: account.waId, text });
  return DROPPED_RESULT;
}

export async function receiveOwnerInbound(input: OwnerInboundInput): Promise<ReceiveResult> {
  const { bindings, waId, channelMessageId, entryOf } = input;
  const isAdmitted = await admitSender({ bindings, waId });
  if (!isAdmitted) return DROPPED_RESULT;
  const dependencies = lifecycleDependenciesOf({ environment: bindings });
  const existing = await dependencies.accounts.findByWaId({ waId });
  const isNewOwnerOnClosedNumber = existing === null && input.number.state === WhatsAppNumberState.Closed;
  if (isNewOwnerOnClosedNumber) return refuseNewAccount(input);
  const lookup = await openOwnerAccount({
    dependencies,
    waId,
    homeNumberId: input.number.numberId,
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
  const isOnOtherNumber = !created && account.homeNumberId !== input.number.numberId;
  if (isOnOtherNumber) return refuseOtherNumber({ bindings, number: input.number, account });
  const downloadsMedia = !created && account.state === AccountState.Active;
  const entry = await entryOf({ accountId: account.accountId, ownerLocale: account.locale, downloadsMedia });
  const redemption = await redeemAccessInvite({
    dependencies: { accounts: dependencies.accounts, invites: new D1AccessInvites({ database: bindings.CONNECTIONS }) },
    account,
    text: inviteTextOf({ entry }),
    now: createPlatformClock().now(),
  });
  const accountInbox = accountInboxOf<AccountOwnerRpc>({ bindings, accountId: account.accountId });
  const outcome = await accountInbox.receiveAccountMessage({
    account: redemption.account,
    channelMessageId,
    entry,
    publicOrigin: bindings.PUBLIC_ORIGIN,
    appOrigin: bindings.APP_ORIGIN,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  if (redemption.isRedeemed) await noticeRedeemedAccess({ accountInbox, account: redemption.account, appOrigin: bindings.APP_ORIGIN });
  if (outcome.value.deletionConfirmed) await finishDeletion({ bindings, accountId: account.accountId });
  return outcome.value;
}
