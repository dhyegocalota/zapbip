import { DeliveryState, InboxErrorCode, MediaSourceKind, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment, receiveUpload } from '../testing/fixtures';
import { createUpload } from './create-upload';
import { sendMedia } from './send-media';
import type { SendMediaInput } from './types';

const alpha = connectionOf({ agent: 'alpha' });
const IMAGE_LINK: SendMediaInput['source'] = { kind: MediaSourceKind.Link, link: 'https://example.com/a.jpg' };

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function send(input: { environment: Environment } & Partial<Omit<SendMediaInput, 'dependencies' | 'connection'>>) {
  const { environment, ...overrides } = input;
  return sendMedia({
    dependencies: environment.dependencies,
    connection: alpha,
    mediaKind: MessageKind.Image,
    voice: false,
    source: IMAGE_LINK,
    caption: null,
    filename: null,
    replyToMessageId: null,
    ...overrides,
  });
}

async function receivedUpload(input: { environment: Environment; mimeType: string; sizeBytes: number }): Promise<string> {
  const { uploadId } = await createUpload({
    dependencies: input.environment.dependencies,
    connection: alpha,
    filename: 'report.pdf',
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  await receiveUpload({ environment: input.environment, mediaId: uploadId });
  return uploadId;
}

describe('sendMedia', () => {
  test('CU-101 a link source reaches the channel as a link', async () => {
    const environment = await createEnvironment();
    const result = await send({ environment });
    expect(result.delivery).toBe(DeliveryState.Sent);
    expect(environment.sender.sessions[0]).toMatchObject({ kind: MessageKind.Image, source: IMAGE_LINK });
  });

  test('an http link is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() =>
      send({ environment, source: { kind: MediaSourceKind.Link, link: 'http://example.com/a.jpg' } }),
    );
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'url: must be an https URL' });
  });

  test('a voice flag on an image is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => send({ environment, voice: true }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'voice: only audio can be a voice note' });
  });

  test('a caption over the limit is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => send({ environment, caption: 'c'.repeat(1025) }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'caption: must be at most 1024 characters' });
  });

  test('a voice note keeps its flag', async () => {
    const environment = await createEnvironment();
    await send({ environment, mediaKind: MessageKind.Audio, voice: true });
    expect(environment.sender.sessions[0]).toMatchObject({ kind: MessageKind.Audio, voice: true });
  });

  test('a received upload is sent with its stored type and size', async () => {
    const environment = await createEnvironment();
    const mediaId = await receivedUpload({ environment, mimeType: 'application/pdf', sizeBytes: 1000 });
    await send({ environment, mediaKind: MessageKind.Document, source: { kind: MediaSourceKind.Stored, mediaId }, filename: 'report.pdf' });
    expect(environment.sender.sessions[0]).toMatchObject({
      kind: MessageKind.Document,
      source: { kind: MediaSourceKind.Stored, mediaId },
      mimeType: 'application/pdf',
      sizeBytes: 1000,
      filename: 'report.pdf',
    });
  });

  test('an unknown upload is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => send({ environment, source: { kind: MediaSourceKind.Stored, mediaId: 'med_missing' } }));
    expect(error).toEqual({ code: InboxErrorCode.NotFound, message: 'upload_id: upload not found' });
  });

  test('an upload whose bytes never arrived is rejected', async () => {
    const environment = await createEnvironment();
    const { uploadId } = await createUpload({
      dependencies: environment.dependencies,
      connection: alpha,
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
    });
    const error = await captureInboxError(() => send({ environment, source: { kind: MediaSourceKind.Stored, mediaId: uploadId } }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'upload_id: bytes not uploaded yet' });
  });

  test('an upload of the wrong type for the kind is rejected', async () => {
    const environment = await createEnvironment();
    const mediaId = await receivedUpload({ environment, mimeType: 'application/pdf', sizeBytes: 1000 });
    const error = await captureInboxError(() => send({ environment, source: { kind: MediaSourceKind.Stored, mediaId } }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'mime_type: image must be an image/* type' });
  });
});
