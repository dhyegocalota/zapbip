import { InboxErrorCode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { UPLOAD_CLAIM_TTL_MS, UPLOAD_TTL_MS } from '../constants';
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
  test('CU-170 returns the pending upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    const media = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    expect(media).toMatchObject({ mediaId: uploadId, receivedAt: null, claimedAt: environment.clock.now() });
  });

  test('CU-170 refuses a second claim while the first holds the upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.code).toBe(InboxErrorCode.UploadUnavailable);
    expect(error.message).toBe('upload_id: upload already in progress');
  });

  test('CU-170 a released claim can be taken again', async () => {
    const { environment, uploadId } = await pendingUpload();
    const { claimedAt } = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await releaseUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt });
    const media = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    expect(media.mediaId).toBe(uploadId);
  });

  test('the claim TTL covers the whole life of an upload', () => {
    expect(UPLOAD_CLAIM_TTL_MS).toBeGreaterThanOrEqual(UPLOAD_TTL_MS);
  });

  test('a claim cannot be taken over before the upload expires', async () => {
    const { environment, uploadId } = await pendingUpload();
    await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await environment.clock.advance({ ms: UPLOAD_TTL_MS });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.code).toBe(InboxErrorCode.UploadExpired);
  });

  test('a claim younger than the claim TTL still holds the upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await environment.clock.advance({ ms: UPLOAD_CLAIM_TTL_MS - 1 });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.code).toBe(InboxErrorCode.UploadUnavailable);
  });

  test('CU-170 the claimed upload can still be completed', async () => {
    const { environment, uploadId } = await pendingUpload();
    const { claimedAt } = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const media = await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt });
    expect(media.receivedAt).not.toBeNull();
  });

  test('a writer whose claim was replaced cannot complete the upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    const slowWriter = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await releaseUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt: slowWriter.claimedAt });
    await environment.clock.advance({ ms: 1 });
    const currentWriter = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    const error = await captureInboxError(() =>
      completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt: slowWriter.claimedAt }),
    );
    const completed = await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt: currentWriter.claimedAt });
    expect(error.code).toBe(InboxErrorCode.UploadUnavailable);
    expect(completed.receivedAt).not.toBeNull();
  });

  test('a writer whose claim was replaced cannot release the current claim', async () => {
    const { environment, uploadId } = await pendingUpload();
    const slowWriter = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await releaseUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt: slowWriter.claimedAt });
    await environment.clock.advance({ ms: 1 });
    await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await releaseUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt: slowWriter.claimedAt });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.code).toBe(InboxErrorCode.UploadUnavailable);
  });

  test('CU-170 refuses a received upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    const { claimedAt } = await claimUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId, claimedAt });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.message).toBe('upload_id: upload already received');
  });

  test('CU-170 refuses an expired upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await environment.clock.advance({ ms: UPLOAD_TTL_MS });
    const error = await captureInboxError(() => claimUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error.code).toBe(InboxErrorCode.UploadExpired);
  });
});
