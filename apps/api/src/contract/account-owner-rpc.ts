import type { AgentName, OwnerAccountContext, OwnerInboundMessage, ReceiveAccountMessageResult } from '@zapbip/core';
import type { AccountState } from '@zapbip/types';
import type { CallOutcome } from './account-inbox-rpc';

export interface AccountOwnerRpc {
  receiveAccountMessage(input: {
    account: OwnerAccountContext;
    channelMessageId: string;
    ownerMessage: OwnerInboundMessage;
    publicOrigin: string;
  }): Promise<CallOutcome<ReceiveAccountMessageResult>>;
  recordRevocation(input: { agent: AgentName }): Promise<void>;
  cancelWaiters(input: { agent: AgentName }): Promise<void>;
  purge(): Promise<void>;
  setState(input: { state: AccountState }): Promise<void>;
}
