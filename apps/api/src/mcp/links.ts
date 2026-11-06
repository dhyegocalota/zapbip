import { LinkPurpose, MediaSourceKind } from '@zapbip/types';
import { MEDIA_LINK_TTL_MS, UPLOAD_TTL_MS, type MediaStore, type Message } from '@zapbip/core';
import type { ToolContext } from './types';
import { MEDIA_PATH_PREFIX, UPLOAD_PATH_PREFIX } from './constants';

export async function buildMediaLink(input: {
  mediaStore: MediaStore;
  accountId: string;
  origin: string;
  mediaId: string;
}): Promise<string> {
  const { mediaStore, accountId, origin, mediaId } = input;
  const query = await mediaStore.signedLink({ accountId, mediaId, purpose: LinkPurpose.Read, ttlMs: MEDIA_LINK_TTL_MS });
  return `${origin}${MEDIA_PATH_PREFIX}/${accountId}/${mediaId}?${query}`;
}

export async function resolveMediaLink(input: {
  mediaStore: MediaStore;
  accountId: string;
  origin: string;
  message: Message;
}): Promise<string | null> {
  const { message } = input;
  if (!('source' in message)) return null;
  if (message.source.kind === MediaSourceKind.Link) return message.source.link;
  return buildMediaLink({ ...input, mediaId: message.source.mediaId });
}

export async function buildUploadLink(input: { context: ToolContext; uploadId: string }): Promise<string> {
  const { context, uploadId } = input;
  const query = await context.mediaStore.signedLink({
    accountId: context.connection.accountId,
    mediaId: uploadId,
    purpose: LinkPurpose.Upload,
    ttlMs: UPLOAD_TTL_MS,
  });
  return `${context.origin}${UPLOAD_PATH_PREFIX}/${context.connection.accountId}/${uploadId}?${query}`;
}
