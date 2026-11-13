import type { AgentName, ChannelInboundEntry, OwnerAccountContext, ReceiveAccountMessageResult } from '@zapbip/core';
import type { CallOutcome } from './account-inbox-rpc';

export interface AccountOwnerRpc {
  receiveAccountMessage(input: {
    account: OwnerAccountContext;
    channelMessageId: string;
    entry: ChannelInboundEntry;
    publicOrigin: string;
    appOrigin: string;
  }): Promise<CallOutcome<ReceiveAccountMessageResult>>;
  recordRevocation(input: { agent: AgentName }): Promise<void>;
  recordCreation(input: { agent: AgentName; secretDigest: string }): Promise<void>;
  recordRotation(input: { agent: AgentName; secretDigest: string }): Promise<void>;
  cancelWaiters(input: { agent: AgentName }): Promise<void>;
  purge(): Promise<void>;
}
