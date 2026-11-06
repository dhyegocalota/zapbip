import { ChannelError, type MediaStore } from '@zapbip/core';
import { ChannelErrorKind } from '@zapbip/types';
import { z } from 'zod';
import type { GraphClient } from './graph-client';
import type { MediaDownloadRequest } from './inbound-parser';
import { WHATSAPP_MEDIA_HOST_SUFFIXES } from './whatsapp-constants';
import { WhatsAppErrorCode } from './whatsapp-enums';

export class RetriableMediaError extends Error {}

export type MediaDownloadResult = { stored: false } | { stored: true; sizeBytes: number };

type DownloadInput = {
  graph: GraphClient;
  mediaStore: MediaStore;
  accountId: string;
  request: MediaDownloadRequest;
  maxBytes: number;
};

type LengthGuard = { isViolated: boolean };

const NOT_STORED: MediaDownloadResult = { stored: false };
const HTTPS_PROTOCOL = 'https:';
const DIGEST_ALGORITHM = 'SHA-256';
const DIGEST_ENCODING = 'base64';
const STATUS_NOT_FOUND = 404;
const STATUS_REDIRECT_MINIMUM = 300;
const STATUS_REDIRECT_MAXIMUM = 400;
const metadataSchema = z.object({ url: z.string(), file_size: z.number() });

function isAllowedMediaUrl(input: { url: string }): boolean {
  const parsed = URL.parse(input.url);
  if (parsed === null) return false;
  if (parsed.protocol !== HTTPS_PROTOCOL) return false;
  return WHATSAPP_MEDIA_HOST_SUFFIXES.some((suffix) => parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`));
}

async function fetchMetadata(input: { graph: GraphClient; channelMediaId: string }): Promise<z.infer<typeof metadataSchema> | null> {
  try {
    return metadataSchema.parse(await input.graph.get({ path: `/${input.channelMediaId}` }));
  } catch (error) {
    if (!(error instanceof ChannelError)) throw error;
    if (error.errorCode === WhatsAppErrorCode.InboundMediaTooLarge) return null;
    if (error.code === ChannelErrorKind.Timeout) throw new RetriableMediaError(error.message, { cause: error });
    throw error;
  }
}

async function requestBody(input: { graph: GraphClient; url: string }): Promise<Response> {
  try {
    return await input.graph.download({ url: input.url });
  } catch (error) {
    throw new RetriableMediaError('media download failed', { cause: error });
  }
}

function guardLength(input: { sizeBytes: number; guard: LengthGuard }): TransformStream<Uint8Array, Uint8Array> {
  let receivedBytes = 0;
  return new TransformStream({
    transform(chunk, controller) {
      receivedBytes += chunk.byteLength;
      if (receivedBytes <= input.sizeBytes) return controller.enqueue(chunk);
      input.guard.isViolated = true;
      controller.error(new Error('media body is longer than declared'));
    },
    flush(controller) {
      if (receivedBytes === input.sizeBytes) return;
      input.guard.isViolated = true;
      controller.error(new Error('media body is shorter than declared'));
    },
  });
}

async function storeBody(input: DownloadInput & { body: ReadableStream<Uint8Array>; sizeBytes: number }): Promise<MediaDownloadResult> {
  const { accountId, request, mediaStore } = input;
  const [digestBranch, storeBranch] = input.body.tee();
  const digestStream = new crypto.DigestStream(DIGEST_ALGORITHM);
  const guard: LengthGuard = { isViolated: false };
  const discard = (): Promise<void> => mediaStore.delete({ accountId, mediaIds: [request.mediaId] });
  try {
    await Promise.all([
      mediaStore.put({
        accountId,
        mediaId: request.mediaId,
        body: storeBranch.pipeThrough(guardLength({ sizeBytes: input.sizeBytes, guard })),
        sizeBytes: input.sizeBytes,
        mimeType: request.mimeType,
      }),
      digestBranch.pipeTo(digestStream),
    ]);
  } catch (error) {
    if (!guard.isViolated) throw error;
    await discard();
    return NOT_STORED;
  }
  const digestBase64 = Buffer.from(await digestStream.digest).toString(DIGEST_ENCODING);
  if (digestBase64 === request.sha256Base64) return { stored: true, sizeBytes: input.sizeBytes };
  await discard();
  return NOT_STORED;
}

async function attemptDownload(input: DownloadInput & { attempts: number }): Promise<MediaDownloadResult> {
  const metadata = await fetchMetadata({ graph: input.graph, channelMediaId: input.request.channelMediaId });
  if (metadata === null) return NOT_STORED;
  if (!isAllowedMediaUrl({ url: metadata.url })) return NOT_STORED;
  if (metadata.file_size > input.maxBytes) return NOT_STORED;
  const response = await requestBody({ graph: input.graph, url: metadata.url });
  const canRefresh = input.attempts > 1;
  if (response.status === STATUS_NOT_FOUND && canRefresh) return attemptDownload({ ...input, attempts: input.attempts - 1 });
  if (response.status === STATUS_NOT_FOUND) return NOT_STORED;
  const isRedirect = response.status >= STATUS_REDIRECT_MINIMUM && response.status < STATUS_REDIRECT_MAXIMUM;
  if (isRedirect) return NOT_STORED;
  if (!response.ok || response.body === null) throw new RetriableMediaError(`media download answered ${response.status}`);
  return storeBody({ ...input, body: response.body, sizeBytes: metadata.file_size });
}

export function downloadInboundMedia(input: DownloadInput & { attempts: number }): Promise<MediaDownloadResult> {
  return attemptDownload(input);
}
