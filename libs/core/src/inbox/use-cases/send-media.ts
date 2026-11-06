import { MediaOrigin, MediaSourceKind } from '@zapbip/types';
import { CAPTION_MAX_CHARS, FILENAME_MAX_CHARS } from '../constants';
import { invalidInput, notFound } from '../inbox-error-factories';
import type { MediaFields } from '../message';
import { assertHttpsLink, assertMaxChars, assertMediaFits, assertVoiceNote } from '../validation';
import { buildMediaContent } from './media-content';
import { sendContent } from './send-content';
import type { SendMediaInput, SendResult } from './types';

async function resolveMediaFields(input: SendMediaInput): Promise<MediaFields> {
  const { dependencies, mediaKind, source, caption } = input;
  if (source.kind === MediaSourceKind.Link) {
    assertHttpsLink({ value: source.link });
    assertMediaFits({ kind: mediaKind, mimeType: null, sizeBytes: null });
    return { source, mimeType: null, sizeBytes: null, filename: input.filename, caption };
  }
  const media = await dependencies.repository.findMedia({ mediaId: source.mediaId });
  if (media === null || media.origin !== MediaOrigin.Upload) throw notFound({ message: 'upload_id: upload not found' });
  if (media.receivedAt === null) throw invalidInput({ message: 'upload_id: bytes not uploaded yet' });
  assertMediaFits({ kind: mediaKind, mimeType: media.mimeType, sizeBytes: media.sizeBytes });
  const filename = input.filename === null ? media.filename : input.filename;
  return { source, mimeType: media.mimeType, sizeBytes: media.sizeBytes, filename, caption };
}

export async function sendMedia(input: SendMediaInput): Promise<SendResult> {
  const { dependencies, connection, mediaKind, voice, caption, filename, replyToMessageId } = input;
  assertVoiceNote({ kind: mediaKind, voice });
  if (caption !== null) assertMaxChars({ field: 'caption', value: caption, maxChars: CAPTION_MAX_CHARS });
  if (filename !== null) assertMaxChars({ field: 'filename', value: filename, maxChars: FILENAME_MAX_CHARS });
  const fields = await resolveMediaFields(input);
  return sendContent({ dependencies, connection, content: buildMediaContent({ mediaKind, voice, fields }), replyToMessageId });
}
