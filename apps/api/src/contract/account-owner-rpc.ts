import type {
  AccountCommand,
  AccountCommandResult,
  AgentName,
  ChannelInboundEntry,
  OwnerAccountContext,
  ReceiveAccountMessageResult,
} from '@zapbip/core';
import type { CommandKind, DeliveryState } from '@zapbip/types';
import type { CallOutcome } from './account-inbox-rpc';

export type WebCommandKind = CommandKind.CreateAgent | CommandKind.RevokeAgent;

export interface AccountOwnerRpc {
  receiveAccountMessage(input: {
    account: OwnerAccountContext;
    channelMessageId: string;
    entry: ChannelInboundEntry;
    publicOrigin: string;
    appOrigin: string;
  }): Promise<CallOutcome<ReceiveAccountMessageResult>>;
  applyWebCommand(input: {
    account: OwnerAccountContext;
    command: AccountCommand & { kind: WebCommandKind };
    publicOrigin: string;
    appOrigin: string;
  }): Promise<CallOutcome<AccountCommandResult>>;
  noticeAccessOpened(input: {
    account: OwnerAccountContext;
    appOrigin: string;
  }): Promise<CallOutcome<DeliveryState.Sent | DeliveryState.Queued>>;
  listAgentActivity(): Promise<{ agent: string; lastSeenAt: number }[]>;
  recordRevocation(input: { agent: AgentName }): Promise<void>;
  recordCreation(input: { agent: AgentName; secretDigest: string }): Promise<void>;
  recordRotation(input: { agent: AgentName; secretDigest: string }): Promise<void>;
  cancelWaiters(input: { agent: AgentName }): Promise<void>;
  purge(): Promise<void>;
}
