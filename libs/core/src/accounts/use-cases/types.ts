import type { CommandKind } from '@zapbip/types';
import type { ChannelInboundEntry, ReceiveResult } from '../../inbox/use-cases/types';
import type { AccountCommand, OwnerAccountContext } from '../account-types';
import type { AccountDependencies, AccountInboxPurge, AccountLifecycleDependencies } from '../ports';

export type OwnerAccountInput = {
  dependencies: AccountDependencies;
  account: OwnerAccountContext;
  publicOrigin: string;
};

export type ApplyOwnerCommandInput = OwnerAccountInput & { command: AccountCommand };
export type CreateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RevokeAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RotateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type ListAgentConnectionsInput = OwnerAccountInput;
export type RequestAccountDeletionInput = OwnerAccountInput;
export type ConfirmAccountDeletionInput = OwnerAccountInput;

export type OpenOwnerAccountInput = {
  dependencies: AccountLifecycleDependencies;
  waId: string;
  waitlistEnabled: boolean;
  createdAt: number;
};

export type FinishAccountDeletionInput = {
  dependencies: AccountLifecycleDependencies;
  accountId: string;
  inboxPurge: AccountInboxPurge;
};

export type FinishDeletingAccountsInput = {
  dependencies: AccountLifecycleDependencies;
  inboxPurgeFor: (input: { accountId: string }) => AccountInboxPurge;
};

export type ResumeSuspendedAccountInput = {
  dependencies: AccountLifecycleDependencies;
  accountId: string;
};

export type ReceiveAccountMessageInput = {
  dependencies: AccountDependencies;
  account: OwnerAccountContext;
  channelMessageId: string;
  entry: ChannelInboundEntry;
  publicOrigin: string;
};

export type ReceiveAccountMessageResult = ReceiveResult & {
  deletionConfirmed: boolean;
  commandKind: CommandKind | null;
  connectionId: string | null;
};
