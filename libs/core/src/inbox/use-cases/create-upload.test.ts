import { InboxErrorCode, MediaOrigin } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { UPLOAD_TTL_MS } from '../constants';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment } from '../testing/fixtures';
import { createUpload } from './create-upload';

function create(input: { environment: Awaited<ReturnType<typeof createEnvironment>>; mimeType: string; sizeBytes: number }) {
  return createUpload({
    dependencies: input.environment.dependencies,
    connection: connectionOf({ agent: 'alpha' }),
    filename: 'report.pdf',
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
}

describe('createUpload', () => {
  test('CU-127 stores a pending upload that expires after its time to live', async () => {
    const environment = await createEnvironment();
    const result = await create({ environment, mimeType: 'application/pdf', sizeBytes: 1000 });
    expect(result.expiresAt).toBe(environment.clock.now() + UPLOAD_TTL_MS);
    expect(await environment.repository.findMedia({ mediaId: result.uploadId })).toMatchObject({
      origin: MediaOrigin.Upload,
      mimeType: 'application/pdf',
      sizeBytes: 1000,
      filename: 'report.pdf',
      expiresAt: result.expiresAt,
      receivedAt: null,
    });
  });

  test('rejects an empty upload', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => create({ environment, mimeType: 'application/pdf', sizeBytes: 0 }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'size_bytes: must be at least 1' });
  });
});
