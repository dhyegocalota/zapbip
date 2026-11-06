import { LinkPurpose } from '@zapbip/types';
import { Hono } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { readSignedQuery, verifyLink } from '../signing';
import { HttpStatus } from './http-status';

const INLINE_MEDIA_TYPE_PATTERN = /^(image|video|audio)\//;
const ATTACHMENT_DISPOSITION = 'attachment';
const HARDENING_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox' };

export const mediaRoutes = new Hono<{ Bindings: Bindings }>();

mediaRoutes.get('/m/:account_id/:media_id', async (context) => {
  const accountId = context.req.param('account_id');
  const mediaId = context.req.param('media_id');
  const signedQuery = readSignedQuery({ expiry: context.req.query('exp'), signature: context.req.query('sig') });
  const clock = createPlatformClock();
  const isSignatureValid =
    signedQuery !== null &&
    (await verifyLink({
      key: context.env.MEDIA_LINK_SIGNING_KEY,
      accountId,
      mediaId,
      purpose: LinkPurpose.Read,
      expiresAt: signedQuery.expiresAt,
      signature: signedQuery.signature,
      now: clock.now(),
    }));
  if (!isSignatureValid) return context.json({ error: 'forbidden' }, HttpStatus.Forbidden);

  const mediaStore = mediaStoreOf({ bindings: context.env, clock });
  const media = await mediaStore.open({ accountId, mediaId });
  if (!media) return context.json({ error: 'not_found' }, HttpStatus.NotFound);
  logEvent({ event: LogEvent.MediaRead, accountId });
  const isInline = INLINE_MEDIA_TYPE_PATTERN.test(media.mimeType);
  const headers = { ...HARDENING_HEADERS, 'Content-Type': media.mimeType };
  return new Response(media.body, {
    status: HttpStatus.Ok,
    headers: isInline ? headers : { ...headers, 'Content-Disposition': ATTACHMENT_DISPOSITION },
  });
});
