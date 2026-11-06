import { IdPrefix, MediaOrigin } from '@zapbip/types';
import { FILENAME_MAX_CHARS, UPLOAD_TTL_MS } from '../constants';
import { assertMaxChars, assertUploadDeclaration, normalizeMimeType } from '../validation';
import { touchAgent } from './touch-agent';
import type { CreateUploadInput, CreateUploadResult } from './types';

export async function createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
  const { dependencies, connection, filename, mimeType, sizeBytes } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  assertUploadDeclaration({ mimeType, sizeBytes });
  assertMaxChars({ field: 'filename', value: filename, maxChars: FILENAME_MAX_CHARS });
  const mediaId = dependencies.ids.next({ prefix: IdPrefix.Media });
  const expiresAt = dependencies.clock.now() + UPLOAD_TTL_MS;
  await dependencies.repository.insertMedia({
    media: {
      mediaId,
      origin: MediaOrigin.Upload,
      mimeType: normalizeMimeType({ value: mimeType }),
      sizeBytes,
      filename,
      expiresAt,
      receivedAt: null,
      retentionUntil: null,
    },
  });
  return { uploadId: mediaId, expiresAt };
}
