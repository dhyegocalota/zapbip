import { InboxErrorCode } from '@zapbip/types';
import type { StoredMedia } from '../inbox-records';
import { describeUpload, uploadError } from './describe-upload';
import type { ClaimUploadInput } from './types';

export async function claimUpload(input: ClaimUploadInput): Promise<StoredMedia> {
  const { dependencies, mediaId } = input;
  const media = await describeUpload({ dependencies, mediaId });
  const isClaimed = await dependencies.repository.claimUpload({ mediaId });
  if (!isClaimed) throw uploadError({ code: InboxErrorCode.UploadUnavailable, reason: 'upload already in progress' });
  return media;
}
