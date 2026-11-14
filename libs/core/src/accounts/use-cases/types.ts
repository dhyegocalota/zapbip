import type { AccountReplyIntent, AgentChangeStatus, AgentCommandRecipient, CommandKind } from '@zapbip/types';
import type { ConnectionIdentity } from '../../inbox/connection';
import type { ChannelInboundEntry, ReceiveResult } from '../../inbox/use-cases/types';
import type { AccountCommand, OwnerAccountContext } from '../account-types';
import type { AccountDependencies, AccountInboxPurge, AccountLifecycleDependencies } from '../ports';

export type OwnerAccountInput = {
  dependencies: AccountDependencies;
  account: OwnerAccountContext;
  publicOrigin: string;
  appOrigin: string;
};

export type ApprovedCommandKind = CommandKind.CreateAgent | CommandKind.RevokeAgent;

export type AgentRequestInput = {
  dependencies: AccountDependencies;
  connection: ConnectionIdentity;
  publicOrigin: string;
  appOrigin: string;
};

export type ApplyAgentCommandInput = AgentRequestInput & { command: AccountCommand; recipient: AgentCommandRecipient };
export type RequestAccountChangeInput = AgentRequestInput & { kind: ApprovedCommandKind; rawName: string; timeoutMs: number };
export type DescribeAccountInput = Pick<AgentRequestInput, 'dependencies' | 'connection'>;

export type AgentCommandResult = { intent: AccountReplyIntent; installPrompt: string | null };

export type AgentChangeResult = {
  status: AgentChangeStatus;
  intent: AccountReplyIntent | null;
  agent: string | null;
  installPrompt: string | null;
};

export type AccountRepliesInput = Pick<OwnerAccountInput, 'dependencies' | 'account'>;

export type ApplyOwnerCommandInput = OwnerAccountInput & { command: AccountCommand; isRequestLive: boolean };
export type CreateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RevokeAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RotateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type ListAgentConnectionsInput = OwnerAccountInput;
export type RequestAccountDeletionInput = OwnerAccountInput;
export type ConfirmAccountDeletionInput = OwnerAccountInput & { isRequestLive: boolean };

export type OpenOwnerAccountInput = {
  dependencies: AccountLifecycleDependencies;
  waId: string;
  homeNumberId: string;
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

export type ReceiveAccountMessageInput = {
  dependencies: AccountDependencies;
  account: OwnerAccountContext;
  channelMessageId: string;
  entry: ChannelInboundEntry;
  publicOrigin: string;
  appOrigin: string;
};

export type ReceiveAccountMessageResult = ReceiveResult & {
  deletionConfirmed: boolean;
  commandKind: CommandKind | null;
  connectionId: string | null;
};
