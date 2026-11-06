import { InboxErrorCode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { UPLOAD_TTL_MS } from '../constants';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment, receiveUpload } from '../testing/fixtures';
import { createUpload } from './create-upload';
import { describeUpload } from './describe-upload';

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

describe('describeUpload', () => {
  test('describes a pending upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    expect(await describeUpload({ dependencies: environment.dependencies, mediaId: uploadId })).toMatchObject({
      mediaId: uploadId,
      mimeType: 'application/pdf',
    });
  });

  test('CU-128 unknown upload', async () => {
    const { environment } = await pendingUpload();
    const error = await captureInboxError(() => describeUpload({ dependencies: environment.dependencies, mediaId: 'med_missing' }));
    expect(error).toEqual({ code: InboxErrorCode.NotFound, message: 'upload_id: upload not found' });
  });

  test('CU-129 expired upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await environment.clock.advance({ ms: UPLOAD_TTL_MS + 1 });
    const error = await captureInboxError(() => describeUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error).toEqual({ code: InboxErrorCode.UploadExpired, message: 'upload_id: upload expired' });
  });

  test('CU-130 already received upload', async () => {
    const { environment, uploadId } = await pendingUpload();
    await receiveUpload({ environment, mediaId: uploadId });
    const error = await captureInboxError(() => describeUpload({ dependencies: environment.dependencies, mediaId: uploadId }));
    expect(error).toEqual({ code: InboxErrorCode.UploadUnavailable, message: 'upload_id: upload already received' });
  });
});
