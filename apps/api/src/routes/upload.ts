import { Hono } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { verifyLink } from '../signing';
import { LinkPurpose } from '@zapbip/types';
import { accountInboxOf } from './account-inbox-stub';
import { ERROR_STATUS, HttpStatus } from './http-status';

const MEDIA_TYPE_PARAMETERS_PATTERN = /;.*$/;

export const uploadRoutes = new Hono<{ Bindings: Bindings }>();

function mediaTypeOf(input: { header: string }): string {
  return input.header.replace(MEDIA_TYPE_PARAMETERS_PATTERN, '').trim().toLowerCase();
}

uploadRoutes.put('/u/:account_id/:upload_id', async (context) => {
  const accountId = context.req.param('account_id');
  const uploadId = context.req.param('upload_id');
  const expiresAt = Number(context.req.query('exp'));
  const signature = context.req.query('sig');
  const hasSignedQuery = signature !== undefined && Number.isSafeInteger(expiresAt);
  const clock = createPlatformClock();
  const isSignatureValid =
    hasSignedQuery &&
    (await verifyLink({
      key: context.env.UPLOAD_LINK_SIGNING_KEY,
      accountId,
      mediaId: uploadId,
      purpose: LinkPurpose.Upload,
      expiresAt,
      signature,
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
  const contentLength = Number(contentLengthHeader);
  if (contentLength > declaredLength) return context.json({ error: 'payload_too_large' }, HttpStatus.PayloadTooLarge);
  if (contentLength < declaredLength) return context.json({ error: 'length_mismatch' }, HttpStatus.BadRequest);

  const contentType = context.req.header('content-type');
  const isDeclaredType =
    contentType !== undefined && mediaTypeOf({ header: contentType }) === mediaTypeOf({ header: description.value.mimeType });
  if (!isDeclaredType) return context.json({ error: 'unsupported_media_type' }, HttpStatus.UnsupportedMediaType);

  const body = context.req.raw.body;
  if (!body) return context.json({ error: 'length_mismatch' }, HttpStatus.BadRequest);

  const mediaStore = mediaStoreOf({ bindings: context.env, clock });
  await mediaStore.put({
    accountId,
    mediaId: uploadId,
    body,
    sizeBytes: declaredLength,
    mimeType: description.value.mimeType,
  });
  const completion = await inbox.completeUpload({ mediaId: uploadId });
  if (!completion.ok) return context.json({ error: completion.errorCode, message: completion.message }, ERROR_STATUS[completion.errorCode]);
  logEvent({ event: LogEvent.Upload, accountId, sizeBytes: declaredLength });
  return context.json({ upload_id: uploadId }, HttpStatus.Created);
});
