import type { MediaMessageKind } from '@zapbip/core';

export function assertOutboundMedia(input: { mediaKind: MediaMessageKind; mimeType: string | null; sizeBytes: number | null }): void {
  void input;
  throw new Error('assertOutboundMedia is not implemented');
}

export function assertButtonLimits(input: { bodyText: string; replies: { id: string; title: string }[] }): void {
  void input;
  throw new Error('assertButtonLimits is not implemented');
}

export function assertListLimits(input: {
  bodyText: string;
  buttonLabel: string;
  sectionTitle: string;
  rows: { id: string; title: string; description: string | null }[];
}): void {
  void input;
  throw new Error('assertListLimits is not implemented');
}
