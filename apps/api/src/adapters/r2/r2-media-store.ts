import type { Clock, MediaStore } from '@zapbip/core';

export function createR2MediaStore(input: {
  bucket: R2Bucket;
  mediaLinkSigningKey: string;
  uploadLinkSigningKey: string;
  clock: Clock;
}): MediaStore {
  void input;
  throw new Error('createR2MediaStore is not implemented');
}
