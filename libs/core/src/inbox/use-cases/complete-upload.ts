import { InboxErrorCode } from '@zapbip/types';
import { MEDIA_RETENTION_MS } from '../constants';
import type { StoredMedia } from '../inbox-records';
import { describeUpload, uploadError } from './describe-upload';
import type { CompleteUploadInput } from './types';

export async function completeUpload(input: CompleteUploadInput): Promise<StoredMedia> {
  const { dependencies, mediaId, claimedAt } = input;
  const media = await describeUpload({ dependencies, mediaId });
  const receivedAt = dependencies.clock.now();
  const retentionUntil = receivedAt + MEDIA_RETENTION_MS;
  const isReceived = await dependencies.repository.markMediaReceived({ mediaId, claimedAt, receivedAt, retentionUntil });
  if (!isReceived) throw uploadError({ code: InboxErrorCode.UploadUnavailable, reason: 'upload claim was replaced' });
  return { ...media, receivedAt, retentionUntil, expiresAt: null };
}
