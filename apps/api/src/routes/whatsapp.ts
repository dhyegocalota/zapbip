import type { ChannelInboundEntry, OwnerInboundContent, UnavailableOwnerMedia } from '@zapbip/core';
import { ChannelInboundKind, DeliveryState, type OwnerLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { z } from 'zod';
import { findOwnerByPhone } from '../adapters/d1/d1-owner-directory';
import { D1MessageIndex } from '../adapters/d1/d1-message-index';
import { createPlatformClock } from '../adapters/platform/clock';
import { createR2MediaStore } from '../adapters/r2/r2-media-store';
import { answerWebhookChallenge } from '../adapters/whatsapp/challenge';
import { createGraphClient, type GraphClient } from '../adapters/whatsapp/graph-client';
import {
  parseWebhookNotification,
  WebhookField,
  type ParsedChange,
  type ParsedEntry,
  type ParsedInboundEntry,
} from '../adapters/whatsapp/inbound-parser';
import { downloadInboundMedia } from '../adapters/whatsapp/media-download';
import { logOperatorEvent } from '../adapters/whatsapp/operator-log';
import { readWhatsAppEnvironment, type WhatsAppEnvironment } from '../adapters/whatsapp/read-whatsapp-env';
import { verifyWebhookSignature } from '../adapters/whatsapp/signature';
import type { ParsedStatus } from '../adapters/whatsapp/status-parser';
import { OwnerCopyKey, WHATSAPP_COPY } from '../adapters/whatsapp/whatsapp-copy';
import {
  MEDIA_DOWNLOAD_ATTEMPTS,
  MEDIA_MAX_BYTES_INBOUND,
  UNINDEXED_STATUS_RETRY_WINDOW_MS,
  WEBHOOK_MAX_BYTES,
  WEBHOOK_SIGNATURE_HEADER,
} from '../adapters/whatsapp/whatsapp-constants';
import { OperatorEvent, OperatorLogField } from '../adapters/whatsapp/whatsapp-enums';
import { UNAUTHORIZED_BODY, WHATSAPP_WEBHOOK_PATH } from '../contract/constants';
import type { CallOutcome } from '../contract/account-inbox-rpc';
import type { Bindings } from '../contract/env';
import { accountInboxOf } from './account-inbox-stub';
import { HttpStatus } from './http-status';

type RequestContext = {
  bindings: Bindings;
  environment: WhatsAppEnvironment;
  graph: GraphClient;
};

const HUB_MODE_PARAMETER = 'hub.mode';
const HUB_TOKEN_PARAMETER = 'hub.verify_token';
const HUB_CHALLENGE_PARAMETER = 'hub.challenge';
const PLAIN_TEXT_CONTENT_TYPE = 'text/plain';

export const whatsappRoutes = new Hono<{ Bindings: Bindings }>();

function runInSequence<Item, Result>(input: { items: Item[]; run: (item: Item) => Promise<Result> }): Promise<Result[]> {
  return input.items.reduce<Promise<Result[]>>(async (previous, item) => [...(await previous), await input.run(item)], Promise.resolve([]));
}

function valueOf<Value>(input: { outcome: CallOutcome<Value> }): Value {
  if (!input.outcome.ok) throw new Error(input.outcome.message);
  return input.outcome.value;
}

async function readBodyWithLimit(input: { body: ReadableStream<Uint8Array> | null; maxBytes: number }): Promise<ArrayBuffer | null> {
  if (input.body === null) return new ArrayBuffer(0);
  const limit = { isExceeded: false };
  let receivedBytes = 0;
  const limited = input.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        receivedBytes += chunk.byteLength;
        if (receivedBytes <= input.maxBytes) return controller.enqueue(chunk);
        limit.isExceeded = true;
        controller.error(new Error('webhook body is over the limit'));
      },
    }),
  );
  try {
    return await new Response(limited).arrayBuffer();
  } catch (error) {
    if (limit.isExceeded) return null;
    throw error;
  }
}

function isUnavailableMedia(content: OwnerInboundContent | UnavailableOwnerMedia): content is UnavailableOwnerMedia {
  return 'voice' in content && !('mediaId' in content);
}

function nullIfAbsent(input: { value: string | undefined }): string | null {
  return input.value === undefined ? null : input.value;
}

function parseJson(input: { text: string }): { isValid: true; value: unknown } | { isValid: false } {
  try {
    return { isValid: true, value: JSON.parse(input.text) as unknown };
  } catch {
    return { isValid: false };
  }
}

async function channelEntryOf(input: {
  context: RequestContext;
  accountId: string;
  ownerLocale: OwnerLocale;
  parsed: Extract<ParsedEntry, { kind: 'inbound' }>;
}): Promise<ChannelInboundEntry> {
  const { context, accountId, ownerLocale, parsed } = input;
  const { entry, media } = parsed;
  const copy = WHATSAPP_COPY[ownerLocale];
  if (entry.kind === ChannelInboundKind.WindowOnly) return entry;
  if (entry.kind === ChannelInboundKind.Unsupported) {
    logOperatorEvent({ event: OperatorEvent.InboundUnsupported, fields: { [OperatorLogField.UnsupportedType]: entry.unsupportedType } });
    return { kind: entry.kind, at: entry.at, noticeText: copy[OwnerCopyKey.UnsupportedKind] };
  }
  if (media === null) return { ...entry, noticeText: null };
  if (!isUnavailableMedia(entry.content)) throw new Error('media entry has no media content');
  const mediaStore = createR2MediaStore({
    bucket: context.bindings.MEDIA,
    mediaLinkSigningKey: context.bindings.MEDIA_LINK_SIGNING_KEY,
    uploadLinkSigningKey: context.bindings.UPLOAD_LINK_SIGNING_KEY,
    clock: createPlatformClock(),
  });
  const download = await downloadInboundMedia({
    graph: context.graph,
    mediaStore,
    accountId,
    request: media,
    maxBytes: MEDIA_MAX_BYTES_INBOUND,
    attempts: MEDIA_DOWNLOAD_ATTEMPTS,
  });
  if (!download.stored) {
    logOperatorEvent({
      event: OperatorEvent.InboundMediaUnavailable,
      fields: { [OperatorLogField.ChannelMessageId]: parsed.channelMessageId },
    });
    return { ...entry, noticeText: copy[OwnerCopyKey.MediaUnavailable] };
  }
  const content = { ...entry.content, mediaId: media.mediaId, mimeType: media.mimeType, sizeBytes: download.sizeBytes };
  return { ...entry, content, noticeText: null };
}

async function processEntry(input: { context: RequestContext; parsed: ParsedEntry }): Promise<void> {
  const { context, parsed } = input;
  if (parsed.kind === 'rejected') {
    logOperatorEvent({ event: OperatorEvent.InboundUnmapped, fields: { [OperatorLogField.Reason]: parsed.reason } });
    return;
  }
  const owner = await findOwnerByPhone({ database: context.bindings.CONNECTIONS, phone: parsed.fromWaId });
  if (owner === null) {
    logOperatorEvent({ event: OperatorEvent.InboundUnmapped, fields: { [OperatorLogField.ChannelMessageId]: parsed.channelMessageId } });
    return;
  }
  const entry = await channelEntryOf({ context, accountId: owner.accountId, ownerLocale: owner.ownerLocale, parsed });
  const inbox = accountInboxOf({ bindings: context.bindings, accountId: owner.accountId });
  valueOf({
    outcome: await inbox.receiveChannelMessage({ ownerLocale: owner.ownerLocale, channelMessageId: parsed.channelMessageId, entry }),
  });
}

async function processStatus(input: { context: RequestContext; status: ParsedStatus }): Promise<boolean> {
  const { context, status } = input;
  if (status.status === null) {
    logOperatorEvent({ event: OperatorEvent.StatusIgnored, fields: { [OperatorLogField.ChannelMessageId]: status.channelMessageId } });
    return false;
  }
  const indexed = await new D1MessageIndex({ database: context.bindings.CONNECTIONS }).find({ id: status.channelMessageId });
  if (indexed === null) {
    const isYoung = createPlatformClock().now() - status.timestamp < UNINDEXED_STATUS_RETRY_WINDOW_MS;
    if (isYoung) return true;
    logOperatorEvent({ event: OperatorEvent.StatusUnindexed, fields: { [OperatorLogField.ChannelMessageId]: status.channelMessageId } });
    return false;
  }
  const inbox = accountInboxOf({ bindings: context.bindings, accountId: indexed.accountId });
  const result = valueOf({
    outcome: await inbox.applyChannelStatus({ channelMessageId: status.channelMessageId, status: status.status, detail: status.detail }),
  });
  const isFailedIgnored = !result.applied && status.status === DeliveryState.Failed;
  if (isFailedIgnored) {
    logOperatorEvent({
      event: OperatorEvent.StatusFailedIgnored,
      fields: { [OperatorLogField.ChannelMessageId]: status.channelMessageId },
    });
  }
  return false;
}

async function processChange(input: { context: RequestContext; change: ParsedChange }): Promise<boolean[]> {
  const { context, change } = input;
  const isHandledField = change.field === WebhookField.Messages || change.field === WebhookField.Statuses;
  if (!isHandledField) {
    logOperatorEvent({ event: OperatorEvent.NotificationIgnoredField, fields: {} });
    return [false];
  }
  if (change.phoneNumberId !== context.environment.phoneNumberId) {
    logOperatorEvent({ event: OperatorEvent.InboundForeignNumber, fields: {} });
    return [false];
  }
  await runInSequence({ items: change.entries, run: (parsed) => processEntry({ context, parsed }) });
  return runInSequence({ items: change.statuses, run: (status) => processStatus({ context, status }) });
}

whatsappRoutes.get(WHATSAPP_WEBHOOK_PATH, async (context) => {
  const environment = readWhatsAppEnvironment({ env: context.env });
  const answer = await answerWebhookChallenge({
    mode: nullIfAbsent({ value: context.req.query(HUB_MODE_PARAMETER) }),
    token: nullIfAbsent({ value: context.req.query(HUB_TOKEN_PARAMETER) }),
    challenge: nullIfAbsent({ value: context.req.query(HUB_CHALLENGE_PARAMETER) }),
    expectedToken: environment.verifyToken,
  });
  return new Response(answer.body, { status: answer.status, headers: { 'Content-Type': PLAIN_TEXT_CONTENT_TYPE } });
});

whatsappRoutes.post(WHATSAPP_WEBHOOK_PATH, async (context) => {
  const declaredLength = context.req.header('content-length');
  if (declaredLength !== undefined && Number(declaredLength) > WEBHOOK_MAX_BYTES) {
    return context.json({ error: 'payload_too_large' }, HttpStatus.PayloadTooLarge);
  }
  const rawBody = await readBodyWithLimit({ body: context.req.raw.body, maxBytes: WEBHOOK_MAX_BYTES });
  if (rawBody === null) return context.json({ error: 'payload_too_large' }, HttpStatus.PayloadTooLarge);
  const environment = readWhatsAppEnvironment({ env: context.env });
  const isSigned = await verifyWebhookSignature({
    appSecret: environment.appSecret,
    rawBody,
    signatureHeader: nullIfAbsent({ value: context.req.header(WEBHOOK_SIGNATURE_HEADER) }),
  });
  if (!isSigned) return context.json(UNAUTHORIZED_BODY, HttpStatus.Unauthorized);
  const parsedJson = parseJson({ text: new TextDecoder().decode(rawBody) });
  if (!parsedJson.isValid) return context.json({ error: 'invalid_json' }, HttpStatus.BadRequest);
  const changes = await parseWebhookNotification({ rawJson: parsedJson.value }).catch((error: unknown) => {
    if (error instanceof z.ZodError) return null;
    throw error;
  });
  if (changes === null) return context.json({ error: 'invalid_notification' }, HttpStatus.BadRequest);
  const requestContext: RequestContext = {
    bindings: context.env,
    environment,
    graph: createGraphClient({ baseUrl: environment.graphBaseUrl, accessToken: environment.accessToken, fetcher: fetch }),
  };
  const retryFlags = await runInSequence({ items: changes, run: (change) => processChange({ context: requestContext, change }) });
  const shouldRetry = retryFlags.flat().some(Boolean);
  if (shouldRetry) return context.body(null, HttpStatus.ServiceUnavailable);
  return context.body(null, HttpStatus.Ok);
});
