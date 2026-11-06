import type { OwnerInboundContent, UnavailableOwnerMedia, MediaMessageKind } from '@zapbip/core';
import type { ChannelInboundKind } from '@zapbip/types';
import type { OperatorLogReason } from './whatsapp-enums';
import type { ParsedStatus } from './status-parser';

export enum WebhookField {
  Messages = 'messages',
  Statuses = 'statuses',
}

export type MediaDownloadRequest = {
  mediaId: string;
  channelMediaId: string;
  mimeType: string;
  sha256Base64: string;
  filename: string | null;
  caption: string | null;
  mediaKind: MediaMessageKind;
};

export type ParsedInboundEntry =
  | {
      kind: ChannelInboundKind.Owner;
      at: number;
      content: OwnerInboundContent | UnavailableOwnerMedia;
      replyToChannelMessageId: string | null;
    }
  | { kind: ChannelInboundKind.WindowOnly; at: number }
  | { kind: ChannelInboundKind.Unsupported; at: number; unsupportedType: string };

export type ParsedEntry =
  | {
      kind: 'inbound';
      channelMessageId: string;
      fromWaId: string;
      at: number;
      entry: ParsedInboundEntry;
      media: MediaDownloadRequest | null;
    }
  | { kind: 'rejected'; reason: OperatorLogReason };

export type ParsedChange = {
  phoneNumberId: string | null;
  field: string;
  entries: ParsedEntry[];
  statuses: ParsedStatus[];
};

export function parseWebhookNotification(input: { rawJson: unknown }): Promise<ParsedChange[]> {
  void input;
  throw new Error('parseWebhookNotification is not implemented');
}
