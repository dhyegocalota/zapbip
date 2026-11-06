import { InboxError } from '../errors';
import { InboxErrorCode, MediaOrigin } from '@zapbip/types';
import type { StoredMedia } from '../inbox-records';
import { notFound } from '../inbox-error-factories';
import type { DescribeUploadInput } from './types';

function uploadError(input: { code: InboxErrorCode; reason: string }): InboxError {
  return new InboxError({ code: input.code, message: `upload_id: ${input.reason}` });
}

export async function describeUpload(input: DescribeUploadInput): Promise<StoredMedia> {
  const { repository, clock } = input.dependencies;
  const media = await repository.findMedia({ mediaId: input.mediaId });
  if (media === null || media.origin !== MediaOrigin.Upload) throw notFound({ message: 'upload_id: upload not found' });
  if (media.receivedAt !== null) throw uploadError({ code: InboxErrorCode.UploadUnavailable, reason: 'upload already received' });
  const isExpired = media.expiresAt !== null && media.expiresAt <= clock.now();
  if (isExpired) throw uploadError({ code: InboxErrorCode.UploadExpired, reason: 'upload expired' });
  return media;
}
