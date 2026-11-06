import type {
  AskInput,
  AskResult,
  CheckInboxInput,
  CheckInboxResult,
  CreateUploadInput,
  CreateUploadResult,
  GetMessagesInput,
  GetMessagesResult,
  ReactInput,
  ReceiveResult,
  OwnerInboundMessage,
  SendContactsInput,
  SendLocationInput,
  SendMediaInput,
  SendResult,
  SendTextInput,
  WaitForReplyInput,
  WaitForReplyResult,
  CoreDependencies,
  StoredMedia,
} from '@zapbip/core';
import type { DevWakeRpc, WakeRpc } from './wake-rpc';
import type { InboxErrorCode, ChannelErrorKind, OwnerLocale, TemplateKind } from '@zapbip/types';

export type CallOutcome<Value> = { ok: true; value: Value } | { ok: false; errorCode: InboxErrorCode | ChannelErrorKind; message: string };

export type AgentRequest<Input extends { dependencies: CoreDependencies }> = Omit<Input, 'dependencies'>;

export type ScreenEntry = {
  at: number;
  messageId: string | null;
  template: TemplateKind | null;
  text: string;
  options: string[];
};

export interface AccountInboxRpc extends WakeRpc {
  sendText(input: AgentRequest<SendTextInput>): Promise<CallOutcome<SendResult>>;
  sendMedia(input: AgentRequest<SendMediaInput>): Promise<CallOutcome<SendResult>>;
  sendLocation(input: AgentRequest<SendLocationInput>): Promise<CallOutcome<SendResult>>;
  sendContacts(input: AgentRequest<SendContactsInput>): Promise<CallOutcome<SendResult>>;
  react(input: AgentRequest<ReactInput>): Promise<CallOutcome<SendResult>>;
  ask(input: AgentRequest<AskInput>): Promise<CallOutcome<AskResult>>;
  waitForReply(input: AgentRequest<WaitForReplyInput>): Promise<CallOutcome<WaitForReplyResult>>;
  getMessages(input: AgentRequest<GetMessagesInput>): Promise<CallOutcome<GetMessagesResult>>;
  checkInbox(input: AgentRequest<CheckInboxInput>): Promise<CallOutcome<CheckInboxResult>>;
  createUpload(input: AgentRequest<CreateUploadInput>): Promise<CallOutcome<CreateUploadResult>>;
  describeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>>;
  claimUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>>;
  releaseUpload(input: { mediaId: string }): Promise<CallOutcome<void>>;
  completeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>>;
  receiveOwnerMessage(input: {
    ownerLocale: OwnerLocale;
    channelMessageId: string;
    ownerMessage: OwnerInboundMessage;
  }): Promise<CallOutcome<{ messageId: string | null; agent: string | null; duplicate: boolean }>>;
}

export interface DevAccountInboxRpc extends AccountInboxRpc, DevWakeRpc {
  readScreen(): Promise<ScreenEntry[]>;
  advanceClock(input: { advanceMs: number }): Promise<number>;
}
