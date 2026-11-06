import type { AgentName } from './connection';
import type { MediaOrigin, OwnerLocale } from '@zapbip/types';

export type AgentRecord = {
  agent: AgentName;
  lastSeenAt: number;
};

export type OwnerWindow = {
  lastOwnerMessageAt: number | null;
  noticeSentForClosedWindow: boolean;
  closedAt: number | null;
};

export type ChannelStatusDetail = {
  errorCode: number | null;
  errorTitle: string | null;
  pricingCategory: string | null;
  billable: boolean | null;
};

export type RoutingList = {
  promptMessageId: string;
  openedAt: number;
  locale: OwnerLocale;
  resent: boolean;
  reminded: boolean;
};

export type StoredMedia = {
  mediaId: string;
  origin: MediaOrigin;
  mimeType: string;
  sizeBytes: number;
  filename: string | null;
  expiresAt: number | null;
  receivedAt: number | null;
  retentionUntil: number | null;
};
