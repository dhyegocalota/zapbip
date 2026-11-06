import type { MediaStore } from '@zapbip/core';
import { ChannelErrorKind } from '@zapbip/types';
import { z } from 'zod';
import { mapGraphErrorToChannelError } from './channel-error-mapping';
import { GraphRequestError, type GraphClient } from './graph-client';
import type { MediaDownloadRequest } from './inbound-parser';
import { HttpStatus } from '../../routes/http-status';
import { isAllowedMediaUrl } from './media-url-policy';
import { WhatsAppErrorCode } from './whatsapp-enums';

export class RetriableMediaError extends Error {}

export type MediaDownloadResult = { stored: false } | { stored: true; sizeBytes: number };

type DownloadInput = {
  graph: GraphClient;
  mediaStore: MediaStore;
  accountId: string;
  request: MediaDownloadRequest;
  maxBytes: number;
  developmentMediaOrigin: string | null;
};

type LengthGuard = { isViolated: boolean };

const NOT_STORED: MediaDownloadResult = { stored: false };
const DIGEST_ALGORITHM = 'SHA-256';
const DIGEST_ENCODING = 'base64';
const metadataSchema = z.object({ url: z.string(), file_size: z.number() });

async function fetchMetadata(input: { graph: GraphClient; channelMediaId: string }): Promise<z.infer<typeof metadataSchema> | null> {
  try {
    return metadataSchema.parse(await input.graph.get({ path: `/${input.channelMediaId}` }));
  } catch (error) {
    if (!(error instanceof GraphRequestError)) throw error;
    const channelError = mapGraphErrorToChannelError({
      status: error.status,
      errorCode: error.errorCode,
      errorTitle: error.errorTitle,
      message: error.message,
      isTemplateSend: false,
      isReactionSend: false,
    });
    if (channelError.errorCode === WhatsAppErrorCode.InboundMediaTooLarge) return null;
    const isPermanentRejection =
      error.status >= HttpStatus.BadRequest &&
      error.status < HttpStatus.InternalServerError &&
      channelError.code !== ChannelErrorKind.Auth &&
      channelError.code !== ChannelErrorKind.RateLimited;
    if (isPermanentRejection) return null;
    if (channelError.code === ChannelErrorKind.Timeout) throw new RetriableMediaError(channelError.message, { cause: error });
    throw channelError;
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
  if (!isAllowedMediaUrl({ url: metadata.url, developmentMediaOrigin: input.developmentMediaOrigin })) return NOT_STORED;
  if (metadata.file_size > input.maxBytes) return NOT_STORED;
  const response = await requestBody({ graph: input.graph, url: metadata.url });
  const canRefresh = input.attempts > 1;
  if (response.status === HttpStatus.NotFound && canRefresh) return attemptDownload({ ...input, attempts: input.attempts - 1 });
  if (response.status === HttpStatus.NotFound) return NOT_STORED;
  const isRedirect = response.status >= HttpStatus.MultipleChoices && response.status < HttpStatus.BadRequest;
  if (isRedirect) return NOT_STORED;
  if (!response.ok || response.body === null) throw new RetriableMediaError(`media download answered ${response.status}`);
  return storeBody({ ...input, body: response.body, sizeBytes: metadata.file_size });
}

export function downloadInboundMedia(input: DownloadInput & { attempts: number }): Promise<MediaDownloadResult> {
  return attemptDownload(input);
}
