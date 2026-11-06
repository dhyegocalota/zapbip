import { RECEIPT_RETENTION_MS, type ChannelInboundEntry, type OwnerInboundContent, type UnavailableOwnerMedia } from '@zapbip/core';
import { ChannelInboundKind, DeliveryState, type OwnerLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { z } from 'zod';
import { D1MessageIndex } from '../adapters/d1/d1-message-index';
import { createPlatformClock } from '../adapters/platform/clock';
import { createR2MediaStore } from '../adapters/r2/r2-media-store';
import { answerWebhookChallenge } from '../adapters/whatsapp/challenge';
import { createGraphClient } from '../adapters/whatsapp/graph-client';
import {
  parseWebhookNotification,
  WebhookField,
  type ParsedChange,
  type ParsedEntry,
  type ParsedInboundEntry,
} from '../adapters/whatsapp/inbound-parser';
import { downloadInboundMedia } from '../adapters/whatsapp/media-download';
import { logOperatorEvent } from '../adapters/whatsapp/operator-log';
import { readWebhookEnvironment, readWhatsAppEnvironment, type WebhookEnvironment } from '../adapters/whatsapp/read-whatsapp-env';
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
import { OperatorEvent, OperatorLogField, ParsedEntryKind } from '../adapters/whatsapp/whatsapp-enums';
import {
  INVALID_JSON_BODY,
  INVALID_NOTIFICATION_BODY,
  PAYLOAD_TOO_LARGE_BODY,
  UNAUTHORIZED_BODY,
  WHATSAPP_WEBHOOK_PATH,
} from '../contract/constants';
import type { CallOutcome } from '../contract/account-inbox-rpc';
import type { Bindings } from '../contract/env';
import { receiveOwnerInbound } from '../inbound/owner-inbound';
import { accountInboxOf } from './account-inbox-stub';
import { HttpStatus } from '../contract/http-status';

type RequestContext = {
  bindings: Bindings;
  environment: WebhookEnvironment;
  developmentMediaOrigin: string | null;
};

const HUB_MODE_PARAMETER = 'hub.mode';
const HUB_TOKEN_PARAMETER = 'hub.verify_token';
const HUB_CHALLENGE_PARAMETER = 'hub.challenge';
const PLAIN_TEXT_CONTENT_TYPE = 'text/plain';
const CONTENT_TYPE_OPTIONS_HEADER = 'X-Content-Type-Options';
const NO_SNIFF = 'nosniff';

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
  downloadsMedia: boolean;
  parsed: Extract<ParsedEntry, { kind: ParsedEntryKind.Inbound }>;
}): Promise<ChannelInboundEntry> {
  const { context, accountId, ownerLocale, downloadsMedia, parsed } = input;
  const { entry, media } = parsed;
  const copy = WHATSAPP_COPY[ownerLocale];
  if (entry.kind === ChannelInboundKind.WindowOnly) return entry;
  if (entry.kind === ChannelInboundKind.Unsupported) {
    logOperatorEvent({ event: OperatorEvent.InboundUnsupported, fields: { [OperatorLogField.UnsupportedType]: entry.unsupportedType } });
    return { kind: entry.kind, at: entry.at, noticeText: copy[OwnerCopyKey.UnsupportedKind] };
  }
  if (media === null || !downloadsMedia) return { ...entry, noticeText: null };
  if (!isUnavailableMedia(entry.content)) throw new Error('media entry has no media content');
  const mediaStore = createR2MediaStore({
    bucket: context.bindings.MEDIA,
    mediaLinkSigningKey: context.bindings.MEDIA_LINK_SIGNING_KEY,
    uploadLinkSigningKey: context.bindings.UPLOAD_LINK_SIGNING_KEY,
    clock: createPlatformClock(),
  });
  const whatsapp = readWhatsAppEnvironment({ env: context.bindings });
  const download = await downloadInboundMedia({
    graph: createGraphClient({
      baseUrl: whatsapp.graphBaseUrl,
      accessToken: whatsapp.accessToken,
      developmentMediaOrigin: context.developmentMediaOrigin,
      fetcher: fetch,
    }),
    mediaStore,
    accountId,
    request: media,
    maxBytes: MEDIA_MAX_BYTES_INBOUND,
    developmentMediaOrigin: context.developmentMediaOrigin,
    attempts: MEDIA_DOWNLOAD_ATTEMPTS,
    isCommitted: async () =>
      valueOf({
        outcome: await accountInboxOf({ bindings: context.bindings, accountId }).hasChannelReceipt({
          channelMessageId: parsed.channelMessageId,
        }),
      }),
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

async function hasCommittedReceipt(input: { context: RequestContext; accountId: string; channelMessageId: string }): Promise<boolean> {
  const { context, accountId, channelMessageId } = input;
  const inbox = accountInboxOf({ bindings: context.bindings, accountId });
  const isCommitted = valueOf({ outcome: await inbox.hasChannelReceipt({ channelMessageId }) });
  if (isCommitted)
    logOperatorEvent({ event: OperatorEvent.InboundDuplicate, fields: { [OperatorLogField.ChannelMessageId]: channelMessageId } });
  return isCommitted;
}

async function processEntry(input: { context: RequestContext; parsed: ParsedEntry }): Promise<void> {
  const { context, parsed } = input;
  if (parsed.kind === ParsedEntryKind.Rejected) {
    logOperatorEvent({ event: OperatorEvent.InboundUnmapped, fields: { [OperatorLogField.Reason]: parsed.reason } });
    return;
  }
  const isStale = createPlatformClock().now() - parsed.at > RECEIPT_RETENTION_MS;
  if (isStale) {
    logOperatorEvent({ event: OperatorEvent.InboundStale, fields: { [OperatorLogField.ChannelMessageId]: parsed.channelMessageId } });
    return;
  }
  await receiveOwnerInbound({
    bindings: context.bindings,
    waId: parsed.fromWaId,
    channelMessageId: parsed.channelMessageId,
    entryOf: async ({ accountId, ownerLocale, downloadsMedia }) => {
      const isCommitted = downloadsMedia && (await hasCommittedReceipt({ context, accountId, channelMessageId: parsed.channelMessageId }));
      return channelEntryOf({ context, accountId, ownerLocale, downloadsMedia: downloadsMedia && !isCommitted, parsed });
    },
  });
}

function retryOrDropUnknownStatus(input: { status: ParsedStatus; isYoung: boolean }): boolean {
  if (input.isYoung) return true;
  logOperatorEvent({
    event: OperatorEvent.StatusUnindexed,
    fields: { [OperatorLogField.ChannelMessageId]: input.status.channelMessageId },
  });
  return false;
}

async function processStatus(input: { context: RequestContext; status: ParsedStatus }): Promise<boolean> {
  const { context, status } = input;
  if (status.status === null) {
    logOperatorEvent({ event: OperatorEvent.StatusIgnored, fields: { [OperatorLogField.ChannelMessageId]: status.channelMessageId } });
    return false;
  }
  const isYoung = createPlatformClock().now() - status.timestamp < UNINDEXED_STATUS_RETRY_WINDOW_MS;
  const indexed = await new D1MessageIndex({ database: context.bindings.CONNECTIONS }).find({ id: status.channelMessageId });
  if (indexed === null) return retryOrDropUnknownStatus({ status, isYoung });
  const inbox = accountInboxOf({ bindings: context.bindings, accountId: indexed.accountId });
  const result = valueOf({
    outcome: await inbox.applyChannelStatus({ channelMessageId: status.channelMessageId, status: status.status, detail: status.detail }),
  });
  if (!result.found) return retryOrDropUnknownStatus({ status, isYoung });
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

export function createWhatsappRoutes(input: { developmentMediaOrigin: string | null }): Hono<{ Bindings: Bindings }> {
  const whatsappRoutes = new Hono<{ Bindings: Bindings }>();

  whatsappRoutes.get(WHATSAPP_WEBHOOK_PATH, async (context) => {
    const environment = readWebhookEnvironment({ env: context.env });
    const answer = await answerWebhookChallenge({
      mode: nullIfAbsent({ value: context.req.query(HUB_MODE_PARAMETER) }),
      token: nullIfAbsent({ value: context.req.query(HUB_TOKEN_PARAMETER) }),
      challenge: nullIfAbsent({ value: context.req.query(HUB_CHALLENGE_PARAMETER) }),
      expectedToken: environment.verifyToken,
    });
    return new Response(answer.body, {
      status: answer.status,
      headers: { 'Content-Type': PLAIN_TEXT_CONTENT_TYPE, [CONTENT_TYPE_OPTIONS_HEADER]: NO_SNIFF },
    });
  });

  whatsappRoutes.post(WHATSAPP_WEBHOOK_PATH, async (context) => {
    const declaredLength = context.req.header('content-length');
    if (declaredLength !== undefined && Number(declaredLength) > WEBHOOK_MAX_BYTES) {
      return context.json(PAYLOAD_TOO_LARGE_BODY, HttpStatus.PayloadTooLarge);
    }
    const rawBody = await readBodyWithLimit({ body: context.req.raw.body, maxBytes: WEBHOOK_MAX_BYTES });
    if (rawBody === null) return context.json(PAYLOAD_TOO_LARGE_BODY, HttpStatus.PayloadTooLarge);
    const environment = readWebhookEnvironment({ env: context.env });
    const isSigned = await verifyWebhookSignature({
      appSecret: environment.appSecret,
      rawBody,
      signatureHeader: nullIfAbsent({ value: context.req.header(WEBHOOK_SIGNATURE_HEADER) }),
    });
    if (!isSigned) return context.json(UNAUTHORIZED_BODY, HttpStatus.Unauthorized);
    const parsedJson = parseJson({ text: new TextDecoder().decode(rawBody) });
    if (!parsedJson.isValid) return context.json(INVALID_JSON_BODY, HttpStatus.BadRequest);
    const changes = await parseWebhookNotification({ rawJson: parsedJson.value }).catch((error: unknown) => {
      if (error instanceof z.ZodError) return null;
      throw error;
    });
    if (changes === null) return context.json(INVALID_NOTIFICATION_BODY, HttpStatus.BadRequest);
    const requestContext: RequestContext = {
      bindings: context.env,
      environment,
      developmentMediaOrigin: input.developmentMediaOrigin,
    };
    const retryFlags = await runInSequence({ items: changes, run: (change) => processChange({ context: requestContext, change }) });
    const shouldRetry = retryFlags.flat().some(Boolean);
    if (shouldRetry) return context.body(null, HttpStatus.ServiceUnavailable);
    return context.body(null, HttpStatus.Ok);
  });

  return whatsappRoutes;
}
