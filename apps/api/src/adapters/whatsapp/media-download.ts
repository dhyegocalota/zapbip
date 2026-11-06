import type { MediaStore } from '@zapbip/core';
import type { GraphClient } from './graph-client';
import type { MediaDownloadRequest } from './inbound-parser';

export function downloadInboundMedia(input: {
  graph: GraphClient;
  mediaStore: MediaStore;
  accountId: string;
  request: MediaDownloadRequest;
  maxBytes: number;
  attempts: number;
}): Promise<{ stored: boolean }> {
  void input;
  throw new Error('downloadInboundMedia is not implemented');
}
