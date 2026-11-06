import { LinkPurpose } from '@zapbip/types';
import { Hono } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { createR2MediaStore } from '../adapters/r2/r2-media-store';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { verifyLink } from '../signing';
import { HttpStatus } from './http-status';

export const mediaRoutes = new Hono<{ Bindings: Bindings }>();

mediaRoutes.get('/m/:account_id/:media_id', async (context) => {
  const accountId = context.req.param('account_id');
  const mediaId = context.req.param('media_id');
  const expiresAt = Number(context.req.query('exp'));
  const signature = context.req.query('sig');
  const clock = createPlatformClock();
  const hasSignedQuery = signature !== undefined && Number.isSafeInteger(expiresAt);
  const isSignatureValid =
    hasSignedQuery &&
    (await verifyLink({
      key: context.env.MEDIA_LINK_SIGNING_KEY,
      accountId,
      mediaId,
      purpose: LinkPurpose.Read,
      expiresAt,
      signature,
      now: clock.now(),
    }));
  if (!isSignatureValid) return context.json({ error: 'forbidden' }, HttpStatus.Forbidden);

  const mediaStore = createR2MediaStore({
    bucket: context.env.MEDIA,
    mediaLinkSigningKey: context.env.MEDIA_LINK_SIGNING_KEY,
    uploadLinkSigningKey: context.env.UPLOAD_LINK_SIGNING_KEY,
    clock,
  });
  const media = await mediaStore.get({ accountId, mediaId });
  if (!media) return context.json({ error: 'not_found' }, HttpStatus.NotFound);
  logEvent({ event: LogEvent.MediaRead, accountId });
  return new Response(media.bytes, { status: HttpStatus.Ok, headers: { 'Content-Type': media.mimeType } });
});
