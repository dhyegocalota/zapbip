import { INLINE_IMAGE_MAX_BYTES, type Message } from '@zapbip/core';
import { MediaSourceKind, MessageDirection, MessageKind } from '@zapbip/types';
import { BASE64_ENCODING } from './constants';
import { INLINE_IMAGE_CONTENT_TYPE } from '../contract/constants';
import type { InlineImage, ToolContext } from './types';

type StoredOwnerImage = Extract<Message, { kind: MessageKind.Image }> & { source: { kind: MediaSourceKind.Stored; mediaId: string } };

function isInlineOwnerImage(message: Message): message is StoredOwnerImage {
  if (message.kind !== MessageKind.Image) return false;
  if (message.direction !== MessageDirection.FromOwner) return false;
  if (message.source.kind !== MediaSourceKind.Stored) return false;
  return message.sizeBytes !== null && message.sizeBytes <= INLINE_IMAGE_MAX_BYTES;
}

async function readInlineImage(input: { context: ToolContext; message: StoredOwnerImage }): Promise<InlineImage | null> {
  const stored = await input.context.mediaStore.get({
    accountId: input.context.connection.accountId,
    mediaId: input.message.source.mediaId,
  });
  if (!stored) return null;
  return { type: INLINE_IMAGE_CONTENT_TYPE, data: Buffer.from(stored.bytes).toString(BASE64_ENCODING), mimeType: stored.mimeType };
}

export async function readInlineImages(input: { context: ToolContext; messages: Message[] }): Promise<InlineImage[]> {
  const images = await Promise.all(
    input.messages.filter(isInlineOwnerImage).map((message) => readInlineImage({ context: input.context, message })),
  );
  return images.filter((image) => image !== null);
}
