import type { AgentName, ConnectionIdentity } from '../connection';
import type { ChannelInboundKind, DeliveryState, InboxStatus, MediaSourceKind, MessageKind, OwnerLocale, ReplyStatus } from '@zapbip/types';
import type { ContactCard, MediaSource, Message, MessageContent, QuestionOption } from '../message';
import type { MediaMessageKind } from '../constants';
import type { ChannelStatusDetail, StoredMedia } from '../inbox-records';
import type { CoreDependencies } from '../ports';

export type CallContext = {
  dependencies: CoreDependencies;
  connection: ConnectionIdentity;
};

export type SendResult = {
  messageId: string;
  delivery: DeliveryState.Sent | DeliveryState.Queued;
};

export type SendTextInput = CallContext & { text: string; replyToMessageId: string | null };
export type SendMediaInput = CallContext & {
  mediaKind: MediaMessageKind;
  voice: boolean;
  source: Exclude<MediaSource, { kind: MediaSourceKind.Unavailable }>;
  caption: string | null;
  filename: string | null;
  replyToMessageId: string | null;
};
export type SendLocationInput = CallContext & {
  latitude: number;
  longitude: number;
  name: string | null;
  address: string | null;
  replyToMessageId: string | null;
};
export type SendContactsInput = CallContext & { contacts: ContactCard[]; replyToMessageId: string | null };
export type ReactInput = CallContext & { targetMessageId: string; emoji: string | null };

export type AnsweredReply = { status: ReplyStatus.Answered; answer: string; messageId: string };
export type PendingReply = { status: ReplyStatus.Pending; questionId: string };
export type MessageReply = { status: ReplyStatus.Message; messages: Message[] };
export type TimeoutReply = { status: ReplyStatus.Timeout };

export type AskInput = CallContext & { text: string; options: string[]; optionDescriptions: (string | null)[]; timeoutMs: number };
export type AskResult = AnsweredReply | PendingReply;
export type WaitForReplyInput = CallContext & { questionId: string | null; timeoutMs: number };
export type WaitForReplyResult = AnsweredReply | MessageReply | TimeoutReply;

export type CheckInboxInput = CallContext;
export type CheckInboxResult = { status: InboxStatus; messages: Message[] };
export type GetMessagesInput = CallContext & { limit: number };
export type GetMessagesResult = { unread: Message[]; history: Message[] };

export type CreateUploadInput = CallContext & { filename: string; mimeType: string; sizeBytes: number };
export type CreateUploadResult = { uploadId: string; expiresAt: number };

export type OwnerInboundContent =
  | { kind: MessageKind.Text; text: string }
  | {
      kind: MediaMessageKind;
      voice: boolean;
      mediaId: string;
      mimeType: string;
      sizeBytes: number;
      filename: string | null;
      caption: string | null;
    }
  | { kind: MessageKind.Location; latitude: number; longitude: number; name: string | null; address: string | null }
  | { kind: MessageKind.Contacts; contacts: ContactCard[] }
  | { kind: MessageKind.Reaction; targetMessageId: string; emoji: string | null }
  | { kind: MessageKind.Choice; optionId: string; optionTitle: string; optionDescription: string | null };

export type OwnerInboundMessage = {
  at: number;
  replyToMessageId: string | null;
  content: OwnerInboundContent;
};

export type ReceiveOwnerMessageInput = {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  channelMessageId: string;
  ownerMessage: OwnerInboundMessage;
};
export type ReceiveResult = { messageId: string | null; agent: AgentName | null; duplicate: boolean };

export type DescribeUploadInput = { dependencies: CoreDependencies; mediaId: string };
export type CompleteUploadInput = { dependencies: CoreDependencies; mediaId: string };
export type ClaimUploadInput = { dependencies: CoreDependencies; mediaId: string };
export type ReleaseUploadInput = { dependencies: CoreDependencies; mediaId: string };
export type SweepExpiredInput = { dependencies: CoreDependencies };
export type SweepExpiredResult = { nextDueAt: number | null };

export type DeliverToOwnerInput = {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  agent: AgentName | null;
  messageId: string;
  content: MessageContent;
  replyToMessageId: string | null;
};
export type DeliverToOwnerResult = { delivery: DeliveryState.Sent | DeliveryState.Queued };

export type UnavailableOwnerMedia = {
  kind: MediaMessageKind;
  voice: boolean;
  filename: string | null;
  caption: string | null;
};

export type ChannelInboundEntry =
  | {
      kind: ChannelInboundKind.Owner;
      at: number;
      content: OwnerInboundContent | UnavailableOwnerMedia;
      replyToChannelMessageId: string | null;
      noticeText: string | null;
    }
  | { kind: ChannelInboundKind.WindowOnly; at: number }
  | { kind: ChannelInboundKind.Unsupported; at: number; noticeText: string };

export type ReceiveChannelInput = {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  channelMessageId: string;
  entry: ChannelInboundEntry;
};

export type OpenWindowInput = { dependencies: CoreDependencies; ownerLocale: OwnerLocale; at: number };
export type CloseWindowInput = { dependencies: CoreDependencies; at: number };

export type ApplyStatusInput = {
  dependencies: CoreDependencies;
  channelMessageId: string;
  status: DeliveryState.Sent | DeliveryState.Delivered | DeliveryState.Read | DeliveryState.Failed;
  detail: ChannelStatusDetail;
};
export type ApplyStatusResult = { applied: boolean };
