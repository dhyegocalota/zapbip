import { InboxErrorCode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { UPLOAD_TTL_MS } from '../constants';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment } from '../testing/fixtures';
import { claimUpload } from './claim-upload';
import { completeUpload } from './complete-upload';
import { createUpload } from './create-upload';
import { releaseUpload } from './release-upload';

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

describe('claimUpload', () => {
  test('returns the pending upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    const media = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    expect(media).toMatchObject({ mediaId: uploadId, receivedAt: null });
  });

  test('refuses a second claim while the first holds the upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.code).toBe(InboxErrorCode.UploadUnavailable);
    expect(error.message).toBe('upload_id: upload already in progress');
  });

  test('a released claim can be taken again', async () => {
    const { environment, uploadId } = await pendingUpload();
    await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await releaseUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const media = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    expect(media.mediaId).toBe(uploadId);
  });

  test('the claimed upload can still be completed', async () => {
    const { environment, uploadId } = await pendingUpload();
    await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const media = await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    expect(media.receivedAt).not.toBeNull();
  });

  test('refuses a received upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.message).toBe('upload_id: upload already received');
  });

  test('refuses an expired upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await environment.clock.advance({ ms: UPLOAD_TTL_MS });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.code).toBe(InboxErrorCode.UploadExpired);
  });
});
