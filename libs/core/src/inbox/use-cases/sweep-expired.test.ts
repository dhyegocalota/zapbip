import { DeliveryState, MediaOrigin, SECOND_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  MEDIA_RETENTION_MS,
  QUEUE_RETENTION_MS,
  QUESTION_RETENTION_MS,
  RECEIPT_RETENTION_MS,
  UPLOAD_TTL_MS,
  SENDING_STALE_MS,
} from '../constants';
import { insertQueued } from '../testing/channel-fixtures';
import { askAndAbandon, closeWindow, connectionOf, createEnvironment, receiveUpload } from '../testing/fixtures';
import { claimQueued } from './claim-queued';
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
    await receiveUpload({ environment, mediaId: uploadId });
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

  test('CU-38 prunes a receipt past its retention and keeps the next one', async () => {
    const environment = await createEnvironment();
    const { repository, clock } = environment;
    const receivedAt = clock.now();
    await repository.recordChannelReceipt({ wamid: 'wamid.first', receivedAt });
    await repository.recordChannelReceipt({ wamid: 'wamid.second', receivedAt: receivedAt + 1 });
    await clock.advance({ ms: RECEIPT_RETENTION_MS + 1 });
    await sweepExpired({ dependencies: environment.dependencies });
    expect(await repository.recordChannelReceipt({ wamid: 'wamid.first', receivedAt: clock.now() })).toBe(true);
    expect(await repository.recordChannelReceipt({ wamid: 'wamid.second', receivedAt: clock.now() })).toBe(false);
  });

  test('CU-38b requeues a send claim that went stale and keeps a fresh one', async () => {
    const environment = await createEnvironment();
    const { repository, clock } = environment;
    const [stale, fresh] = await insertQueued({ environment, texts: ['stale', 'fresh'] });
    await repository.claimQueuedMessages({ claimedAt: clock.now(), limit: 1 });
    await clock.advance({ ms: SENDING_STALE_MS - 1 });
    await claimQueued({ dependencies: environment.dependencies });
    await clock.advance({ ms: 2 });
    await sweepExpired({ dependencies: environment.dependencies });
    expect(await repository.findMessage({ messageId: stale!.messageId })).toMatchObject({ delivery: DeliveryState.Queued });
    expect(await repository.findMessage({ messageId: fresh!.messageId })).toMatchObject({ delivery: DeliveryState.Sending });
  });

  test('reports a stale claim as due', async () => {
    const environment = await createEnvironment();
    await insertQueued({ environment, texts: ['claimed'] });
    const claimedAt = environment.clock.now();
    await claimQueued({ dependencies: environment.dependencies });
    expect(await sweepExpired({ dependencies: environment.dependencies })).toEqual({ nextDueAt: claimedAt + SENDING_STALE_MS });
  });
});
