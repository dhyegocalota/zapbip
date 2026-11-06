import { normalizeMimeType } from '@zapbip/core';
import { Hono } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import { PAYLOAD_TOO_LARGE_BODY } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { readSignedQuery, verifyLink } from '../signing';
import { LinkPurpose } from '@zapbip/types';
import { accountInboxOf } from './account-inbox-stub';
import { ERROR_STATUS, HttpStatus } from './http-status';

const CONTENT_LENGTH_PATTERN = /^\d+$/;

export const uploadRoutes = new Hono<{ Bindings: Bindings }>();

uploadRoutes.put('/u/:account_id/:upload_id', async (context) => {
  const accountId = context.req.param('account_id');
  const uploadId = context.req.param('upload_id');
  const signedQuery = readSignedQuery({ expiry: context.req.query('exp'), signature: context.req.query('sig') });
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
  if (contentLength > declaredLength) return context.json(PAYLOAD_TOO_LARGE_BODY, HttpStatus.PayloadTooLarge);
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
  try {
    await mediaStore.put({
      accountId,
      mediaId: uploadId,
      body,
      sizeBytes: declaredLength,
      mimeType: description.value.mimeType,
    });
  } catch (error) {
    await inbox.releaseUpload({ mediaId: uploadId });
    throw error;
  }
  const completion = await inbox.completeUpload({ mediaId: uploadId });
  if (!completion.ok) return context.json({ error: completion.errorCode, message: completion.message }, ERROR_STATUS[completion.errorCode]);
  logEvent({ event: LogEvent.Upload, accountId, sizeBytes: declaredLength });
  return context.json({ upload_id: uploadId }, HttpStatus.Created);
});
