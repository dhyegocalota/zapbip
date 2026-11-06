import type { Clock, MediaStore } from '@zapbip/core';
import { LinkPurpose } from '@zapbip/types';
import { signLink } from '../../signing';

const MEDIA_KEY_PREFIX = 'accounts';
const MEDIA_KEY_SEGMENT = 'media';

function objectKey(input: { accountId: string; mediaId: string }): string {
  return [MEDIA_KEY_PREFIX, input.accountId, MEDIA_KEY_SEGMENT, input.mediaId].join('/');
}

export function createR2MediaStore(input: {
  bucket: R2Bucket;
  mediaLinkSigningKey: string;
  uploadLinkSigningKey: string;
  clock: Clock;
}): MediaStore {
  const signingKeys: Record<LinkPurpose, string> = {
    [LinkPurpose.Read]: input.mediaLinkSigningKey,
    [LinkPurpose.Upload]: input.uploadLinkSigningKey,
  };

  return {
    async put({ accountId, mediaId, body, sizeBytes, mimeType }) {
      const fixedLengthStream = new FixedLengthStream(sizeBytes);
      const piping = body.pipeTo(fixedLengthStream.writable);
      await input.bucket.put(objectKey({ accountId, mediaId }), fixedLengthStream.readable, { httpMetadata: { contentType: mimeType } });
      await piping;
    },

    async get({ accountId, mediaId }) {
      const object = await input.bucket.get(objectKey({ accountId, mediaId }));
      if (object === null) return null;
      const mimeType = object.httpMetadata?.contentType;
      if (mimeType === undefined) throw new Error('media object has no content type');
      return { bytes: new Uint8Array(await object.arrayBuffer()), mimeType };
    },

    async signedLink({ accountId, mediaId, purpose, ttlMs }) {
      const expiresAt = input.clock.now() + ttlMs;
      const signature = await signLink({ key: signingKeys[purpose], accountId, mediaId, purpose, expiresAt });
      return `exp=${expiresAt}&sig=${signature}`;
    },

    async delete({ accountId, mediaIds }) {
      await input.bucket.delete(mediaIds.map((mediaId) => objectKey({ accountId, mediaId })));
    },
  };
}
