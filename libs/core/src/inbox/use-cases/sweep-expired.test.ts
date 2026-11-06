import { DeliveryState, MediaOrigin, SECOND_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { MEDIA_RETENTION_MS, QUEUE_RETENTION_MS, QUESTION_RETENTION_MS, RECEIPT_RETENTION_MS, UPLOAD_TTL_MS } from '../constants';
import { askAndAbandon, closeWindow, connectionOf, createEnvironment } from '../testing/fixtures';
import { completeUpload } from './complete-upload';
import { createUpload } from './create-upload';
import { sendText } from './send-text';
import { sweepExpired } from './sweep-expired';

const alpha = connectionOf({ agent: 'alpha' });

describe('sweepExpired', () => {
  test('CU-152 removes expired media, queued messages, questions and receipts', async () => {
    const environment = await createEnvironment();
    const { repository, mediaStore, clock } = environment;
    const { uploadId } = await createUpload({
      dependencies: environment.dependencies,
      connection: alpha,
      filename: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
    await completeUpload({ dependencies: environment.dependencies, mediaId: uploadId });
    await mediaStore.put({
      accountId: environment.dependencies.accountId,
      mediaId: uploadId,
      body: new Blob(['x']).stream(),
      sizeBytes: 1,
      mimeType: 'application/pdf',
    });
    await closeWindow({ environment });
    const queued = await sendText({ dependencies: environment.dependencies, connection: alpha, text: 'queued', replyToMessageId: null });
    const question = await askAndAbandon({ environment });
    await repository.recordChannelReceipt({ wamid: 'wamid.old', receivedAt: clock.now() });
    await clock.advance({ ms: MEDIA_RETENTION_MS + 1 });
    await sweepExpired({ dependencies: environment.dependencies });
    expect(await repository.findMedia({ mediaId: uploadId })).toBeNull();
    expect(mediaStore.hasObject({ mediaId: uploadId })).toBe(false);
    expect(await repository.findMessage({ messageId: queued.messageId })).toMatchObject({ delivery: DeliveryState.Expired });
    expect(await repository.findQuestion({ questionId: question.questionId })).toBeNull();
    expect(await repository.recordChannelReceipt({ wamid: 'wamid.old', receivedAt: clock.now() })).toBe(true);
  });

  test('keeps what is still within its retention', async () => {
    const environment = await createEnvironment();
    const { repository, clock } = environment;
    const question = await askAndAbandon({ environment });
    await repository.recordChannelReceipt({ wamid: 'wamid.fresh', receivedAt: clock.now() });
    await clock.advance({ ms: Math.min(QUESTION_RETENTION_MS, RECEIPT_RETENTION_MS, QUEUE_RETENTION_MS) - 2 * SECOND_MS });
    await sweepExpired({ dependencies: environment.dependencies });
    expect(await repository.findQuestion({ questionId: question.questionId })).not.toBeNull();
    expect(await repository.recordChannelReceipt({ wamid: 'wamid.fresh', receivedAt: clock.now() })).toBe(false);
  });

  test('removes a pending upload that was never received', async () => {
    const environment = await createEnvironment();
    const { uploadId } = await createUpload({
      dependencies: environment.dependencies,
      connection: alpha,
      filename: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
    await environment.clock.advance({ ms: UPLOAD_TTL_MS });
    await sweepExpired({ dependencies: environment.dependencies });
    expect(await environment.repository.findMedia({ mediaId: uploadId })).toBeNull();
  });

  test('CU-153 reports the next due time', async () => {
    const environment = await createEnvironment();
    expect(await sweepExpired({ dependencies: environment.dependencies })).toEqual({ nextDueAt: null });
    const now = environment.clock.now();
    await environment.repository.insertMedia({
      media: {
        mediaId: 'med_pending',
        origin: MediaOrigin.Upload,
        mimeType: 'application/pdf',
        sizeBytes: 1,
        filename: null,
        expiresAt: now + 5,
        receivedAt: null,
        retentionUntil: null,
      },
    });
    await environment.repository.insertMedia({
      media: {
        mediaId: 'med_kept',
        origin: MediaOrigin.Owner,
        mimeType: 'image/jpeg',
        sizeBytes: 1,
        filename: null,
        expiresAt: null,
        receivedAt: now,
        retentionUntil: now + 9,
      },
    });
    expect(await sweepExpired({ dependencies: environment.dependencies })).toEqual({ nextDueAt: now + 5 });
  });
});
