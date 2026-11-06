import { InboxErrorCode } from '@zapbip/types';
import { UPLOAD_CLAIM_TTL_MS } from '../constants';
import { describeUpload, uploadError } from './describe-upload';
import type { ClaimUploadInput, UploadClaim } from './types';

export async function claimUpload(input: ClaimUploadInput): Promise<UploadClaim> {
  const { dependencies, mediaId } = input;
  const media = await describeUpload({ dependencies, mediaId });
  const claimedAt = dependencies.clock.now();
  const isClaimed = await dependencies.repository.claimUpload({ mediaId, claimedAt, staleBefore: claimedAt - UPLOAD_CLAIM_TTL_MS });
  if (!isClaimed) throw uploadError({ code: InboxErrorCode.UploadUnavailable, reason: 'upload already in progress' });
  return { ...media, claimedAt };
}
