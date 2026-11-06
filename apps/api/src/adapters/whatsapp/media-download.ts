import type { MediaStore } from '@zapbip/core';
import type { GraphClient } from './graph-client';
import type { MediaDownloadRequest } from './inbound-parser';

export class RetriableMediaError extends Error {}

export type MediaDownloadResult = { stored: false } | { stored: true; sizeBytes: number };

export function downloadInboundMedia(input: {
  graph: GraphClient;
  mediaStore: MediaStore;
  accountId: string;
  request: MediaDownloadRequest;
  maxBytes: number;
  attempts: number;
}): Promise<MediaDownloadResult> {
  void input;
  throw new Error('downloadInboundMedia is not implemented');
}
