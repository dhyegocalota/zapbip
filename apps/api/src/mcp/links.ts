import { LinkPurpose } from '@zapbip/types';
import { MEDIA_LINK_TTL_MS, UPLOAD_TTL_MS } from '@zapbip/core';
import type { ToolContext } from './types';
import { MEDIA_PATH_PREFIX, UPLOAD_PATH_PREFIX } from './constants';

export async function buildMediaLink(input: { context: ToolContext; mediaId: string }): Promise<string> {
  const { context, mediaId } = input;
  const query = await context.mediaStore.signedLink({
    accountId: context.connection.accountId,
    mediaId,
    purpose: LinkPurpose.Read,
    ttlMs: MEDIA_LINK_TTL_MS,
  });
  return `${context.origin}${MEDIA_PATH_PREFIX}/${context.connection.accountId}/${mediaId}?${query}`;
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
