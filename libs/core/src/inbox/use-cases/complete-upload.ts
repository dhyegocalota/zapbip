import { MEDIA_RETENTION_MS } from '../constants';
import type { StoredMedia } from '../inbox-records';
import { describeUpload } from './describe-upload';
import type { CompleteUploadInput } from './types';

export async function completeUpload(input: CompleteUploadInput): Promise<StoredMedia> {
  const { dependencies, mediaId } = input;
  const media = await describeUpload({ dependencies, mediaId });
  const receivedAt = dependencies.clock.now();
  const retentionUntil = receivedAt + MEDIA_RETENTION_MS;
  await dependencies.repository.markMediaReceived({ mediaId, receivedAt, retentionUntil });
  return { ...media, receivedAt, retentionUntil, expiresAt: null };
}
