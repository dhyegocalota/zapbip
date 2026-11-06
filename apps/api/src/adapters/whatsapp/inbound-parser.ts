import type { ChannelInboundEntry, MediaMessageKind } from '@zapbip/core';
import type { OperatorLogReason } from './whatsapp-enums';
import type { ParsedStatus } from './status-parser';

export type MediaDownloadRequest = {
  mediaId: string;
  channelMediaId: string;
  mimeType: string;
  sizeBytes: number;
  sha256Base64: string;
  filename: string | null;
  caption: string | null;
  mediaKind: MediaMessageKind;
};

export type ParsedEntry =
  | {
      kind: 'inbound';
      channelMessageId: string;
      fromWaId: string;
      at: number;
      entry: ChannelInboundEntry;
      media: MediaDownloadRequest | null;
    }
  | { kind: 'rejected'; reason: OperatorLogReason };

export type ParsedChange = {
  phoneNumberId: string;
  field: string;
  entries: ParsedEntry[];
  statuses: ParsedStatus[];
};

export function parseWebhookNotification(input: { rawJson: unknown }): ParsedChange[] {
  void input;
  throw new Error('parseWebhookNotification is not implemented');
}
