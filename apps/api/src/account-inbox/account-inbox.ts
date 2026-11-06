import { DurableObject } from 'cloudflare:workers';
import type {
  AskInput,
  AskResult,
  CheckInboxInput,
  CheckInboxResult,
  Clock,
  CreateUploadInput,
  CreateUploadResult,
  GetMessagesInput,
  GetMessagesResult,
  MessageSender,
  ReactInput,
  SendContactsInput,
  SendLocationInput,
  SendMediaInput,
  SendResult,
  SendTextInput,
  StoredMedia,
  WaitForReplyInput,
  WaitForReplyResult,
} from '@zapbip/core';
import type { AccountInboxRpc, AgentRequest, CallOutcome } from '../contract/account-inbox-rpc';
import type { DueTimeProvider } from '../contract/due-time-provider';
import type { Bindings } from '../contract/env';

export class AccountInbox extends DurableObject<Bindings> implements AccountInboxRpc {
  protected sender!: MessageSender;
  protected clock!: Clock;
  protected readonly dueTimeProviders: DueTimeProvider[] = [];

  protected armAlarm(): Promise<void> {
    throw new Error('armAlarm is not implemented');
  }

  alarm(): Promise<void> {
    void 0;
    throw new Error('alarm is not implemented');
  }

  sendText(input: AgentRequest<SendTextInput>): Promise<CallOutcome<SendResult>> {
    void input;
    throw new Error('sendText is not implemented');
  }

  sendMedia(input: AgentRequest<SendMediaInput>): Promise<CallOutcome<SendResult>> {
    void input;
    throw new Error('sendMedia is not implemented');
  }

  sendLocation(input: AgentRequest<SendLocationInput>): Promise<CallOutcome<SendResult>> {
    void input;
    throw new Error('sendLocation is not implemented');
  }

  sendContacts(input: AgentRequest<SendContactsInput>): Promise<CallOutcome<SendResult>> {
    void input;
    throw new Error('sendContacts is not implemented');
  }

  react(input: AgentRequest<ReactInput>): Promise<CallOutcome<SendResult>> {
    void input;
    throw new Error('react is not implemented');
  }

  ask(input: AgentRequest<AskInput>): Promise<CallOutcome<AskResult>> {
    void input;
    throw new Error('ask is not implemented');
  }

  waitForReply(input: AgentRequest<WaitForReplyInput>): Promise<CallOutcome<WaitForReplyResult>> {
    void input;
    throw new Error('waitForReply is not implemented');
  }

  getMessages(input: AgentRequest<GetMessagesInput>): Promise<CallOutcome<GetMessagesResult>> {
    void input;
    throw new Error('getMessages is not implemented');
  }

  checkInbox(input: AgentRequest<CheckInboxInput>): Promise<CallOutcome<CheckInboxResult>> {
    void input;
    throw new Error('checkInbox is not implemented');
  }

  createUpload(input: AgentRequest<CreateUploadInput>): Promise<CallOutcome<CreateUploadResult>> {
    void input;
    throw new Error('createUpload is not implemented');
  }

  describeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>> {
    void input;
    throw new Error('describeUpload is not implemented');
  }

  completeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>> {
    void input;
    throw new Error('completeUpload is not implemented');
  }

  receiveOwnerMessage(
    input: Parameters<AccountInboxRpc['receiveOwnerMessage']>[0],
  ): Promise<CallOutcome<{ messageId: string | null; agent: string | null; duplicate: boolean }>> {
    void input;
    throw new Error('receiveOwnerMessage is not implemented');
  }
}
