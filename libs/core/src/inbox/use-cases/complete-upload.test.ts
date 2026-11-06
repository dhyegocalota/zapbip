import { InboxErrorCode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { MEDIA_RETENTION_MS, UPLOAD_TTL_MS } from '../constants';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment } from '../testing/fixtures';
import { claimUpload } from './claim-upload';
import { completeUpload } from './complete-upload';
import { createUpload } from './create-upload';

async function pendingUpload() {
  const environment = await createEnvironment();
  const { uploadId } = await createUpload({
    dependencies: environment.dependencies,
    connection: connectionOf({ agent: 'alpha' }),
    filename: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1000,
  });
  return { environment, uploadId };
}

describe('completeUpload', () => {
  test('CU-131 sets the receive time and the retention', async () => {
    const { environment, uploadId } = await pendingUpload();
    const receivedAt = environment.clock.now();
    const { claimedAt } = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const media = await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt });
    expect(media).toMatchObject({ receivedAt, retentionUntil: receivedAt + MEDIA_RETENTION_MS });
    expect(await environment.repository.findMedia({ mediaId: uploadId })).toEqual(media);
  });

  test('refuses a second completion', async () => {
    const { environment, uploadId } = await pendingUpload();
    const { claimedAt } = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt });
    const error = await captureInboxError(() => completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt }));
    expect(error.code).toBe(InboxErrorCode.UploadUnavailable);
  });

  test('refuses an expired upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    const { claimedAt } = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await environment.clock.advance({ ms: UPLOAD_TTL_MS });
    const error = await captureInboxError(() => completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt }));
    expect(error.code).toBe(InboxErrorCode.UploadExpired);
  });
});
