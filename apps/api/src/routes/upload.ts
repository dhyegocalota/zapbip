import { normalizeMimeType } from '@zapbip/core';
import { Hono } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { readSignedQuery, verifyLink } from '../signing';
import { LinkPurpose } from '@zapbip/types';
import { accountInboxOf } from './account-inbox-stub';
import { ERROR_STATUS, HttpStatus } from './http-status';

const CONTENT_LENGTH_PATTERN = /^\d+$/;

type TrackedBody = { stream: ReadableStream<Uint8Array>; clientFailure: { occurred: boolean } };

function trackClientFailure(input: { body: ReadableStream<Uint8Array>; sizeBytes: number }): TrackedBody {
  const reader = input.body.getReader();
  const clientFailure = { occurred: false };
  const received = { bytes: 0 };
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        received.bytes += chunk.done ? 0 : chunk.value.byteLength;
        clientFailure.occurred = chunk.done && received.bytes < input.sizeBytes;
        if (chunk.done) return controller.close();
        controller.enqueue(chunk.value);
      } catch (error) {
        clientFailure.occurred = true;
        controller.error(error);
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return { stream, clientFailure };
}

export const uploadRoutes = new Hono<{ Bindings: Bindings }>();

uploadRoutes.put('/u/:account_id/:upload_id', async (context) => {
  const accountId = context.req.param('account_id');
  const uploadId = context.req.param('upload_id');
  const signedQuery = readSignedQuery({ expiries: context.req.queries('exp'), signatures: context.req.queries('sig') });
  const clock = createPlatformClock();
  const isSignatureValid =
    signedQuery !== null &&
    (await verifyLink({
      key: context.env.UPLOAD_LINK_SIGNING_KEY,
      accountId,
      mediaId: uploadId,
      purpose: LinkPurpose.Upload,
      expiresAt: signedQuery.expiresAt,
      signature: signedQuery.signature,
      now: clock.now(),
    }));
  if (!isSignatureValid) return context.json({ error: 'forbidden' }, HttpStatus.Forbidden);

  const inbox = accountInboxOf({ bindings: context.env, accountId });
  const description = await inbox.describeUpload({ mediaId: uploadId });
  if (!description.ok)
    return context.json({ error: description.errorCode, message: description.message }, ERROR_STATUS[description.errorCode]);

  const declaredLength = description.value.sizeBytes;
  const contentLengthHeader = context.req.header('content-length');
  if (contentLengthHeader === undefined) return context.json({ error: 'length_required' }, HttpStatus.LengthRequired);
  if (!CONTENT_LENGTH_PATTERN.test(contentLengthHeader)) return context.json({ error: 'invalid_length' }, HttpStatus.BadRequest);
  const contentLength = Number(contentLengthHeader);
  if (contentLength > declaredLength) return context.json({ error: 'payload_too_large' }, HttpStatus.PayloadTooLarge);
  if (contentLength < declaredLength) return context.json({ error: 'length_mismatch' }, HttpStatus.BadRequest);

  const contentType = context.req.header('content-type');
  const isDeclaredType =
    contentType !== undefined && normalizeMimeType({ value: contentType }) === normalizeMimeType({ value: description.value.mimeType });
  if (!isDeclaredType) return context.json({ error: 'unsupported_media_type' }, HttpStatus.UnsupportedMediaType);

  const body = context.req.raw.body;
  if (!body) return context.json({ error: 'length_mismatch' }, HttpStatus.BadRequest);

  const claim = await inbox.claimUpload({ mediaId: uploadId });
  if (!claim.ok) return context.json({ error: claim.errorCode, message: claim.message }, ERROR_STATUS[claim.errorCode]);

  const mediaStore = mediaStoreOf({ bindings: context.env, clock });
  const tracked = trackClientFailure({ body, sizeBytes: declaredLength });
  try {
    await mediaStore.put({
      accountId,
      mediaId: uploadId,
      body: tracked.stream,
      sizeBytes: declaredLength,
      mimeType: description.value.mimeType,
    });
  } catch (error) {
    await inbox.releaseUpload({ mediaId: uploadId, claimedAt: claim.value.claimedAt });
    const isClientAbort = tracked.clientFailure.occurred;
    if (isClientAbort) return context.json({ error: 'upload_incomplete' }, HttpStatus.BadRequest);
    throw error;
  }
  const completion = await inbox.completeUpload({ mediaId: uploadId, claimedAt: claim.value.claimedAt });
  if (!completion.ok) return context.json({ error: completion.errorCode, message: completion.message }, ERROR_STATUS[completion.errorCode]);
  logEvent({ event: LogEvent.Upload, accountId, sizeBytes: declaredLength });
  return context.json({ upload_id: uploadId }, HttpStatus.Created);
});
