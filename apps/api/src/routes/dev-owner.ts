import { ChannelInboundKind, ForwardedKind, MessageKind, type OwnerLocale } from '@zapbip/types';
import { assertMediaFits, InboxError, invalidInput, notFound, type ChannelInboundEntry, type OwnerInboundContent } from '@zapbip/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { D1MessageIndex } from '../adapters/d1/d1-message-index';
import { findOwnerByPhone } from '../adapters/d1/d1-owner-directory';
import { createPlatformClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import { receiveOwnerInbound } from '../inbound/owner-inbound';
import type { DevAccountInboxRpc } from '../contract/account-inbox-rpc';
import { DEV_OWNER_PATH_PREFIX, OWNER_PHONE_PATTERN } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { contactInputSchema, sendableMediaKind } from '../contract/mcp-schemas';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { accountInboxOf } from './account-inbox-stub';
import { HttpStatus } from '../contract/http-status';
import { ERROR_STATUS } from './http-status';

type OwnerIdentity = { accountId: string; ownerLocale: OwnerLocale };

const nullableString = z.string().nullable().default(null);
const commonShape = { wamid: z.string().default(() => `wamid.${crypto.randomUUID()}`), reply_to: nullableString };

const textSchema = z.object({ kind: z.literal(MessageKind.Text), text: z.string(), ...commonShape });
const mediaSchema = z.object({
  kind: sendableMediaKind,
  mime_type: z.string(),
  data_base64: z.base64(),
  voice: z.boolean().default(false),
  filename: nullableString,
  caption: nullableString,
  ...commonShape,
});
const locationSchema = z.object({
  kind: z.literal(MessageKind.Location),
  latitude: z.number(),
  longitude: z.number(),
  name: nullableString,
  address: nullableString,
  ...commonShape,
});
const contactsSchema = z.object({ kind: z.literal(MessageKind.Contacts), contacts: z.array(contactInputSchema), ...commonShape });
const reactionSchema = z.object({
  kind: z.literal(MessageKind.Reaction),
  target_message_id: z.string(),
  emoji: z.string().nullable(),
  ...commonShape,
});
const choiceSchema = z.object({
  kind: z.literal(MessageKind.Choice),
  option_id: z.string(),
  title: z.string(),
  description: nullableString,
  ...commonShape,
});

const ownerMessageSchema = z.discriminatedUnion('kind', [
  textSchema,
  mediaSchema,
  locationSchema,
  contactsSchema,
  reactionSchema,
  choiceSchema,
]);
const clockSchema = z.object({ advance_ms: z.number().int().positive() });

type OwnerMessageBody = z.infer<typeof ownerMessageSchema>;
type MediaBody = z.infer<typeof mediaSchema>;
type ContentBuilders = { [Kind in OwnerMessageBody['kind']]: (body: Extract<OwnerMessageBody, { kind: Kind }>) => OwnerInboundContent };

function mediaContent(body: MediaBody): OwnerInboundContent {
  return {
    kind: body.kind,
    voice: body.voice,
    mediaId: body.wamid,
    mimeType: body.mime_type,
    sizeBytes: decodeBytes({ base64: body.data_base64 }).byteLength,
    filename: body.filename,
    caption: body.caption,
  };
}

const CONTENT_BUILDERS: ContentBuilders = {
  [MessageKind.Text]: (body) => ({ kind: MessageKind.Text, text: body.text }),
  [MessageKind.Image]: mediaContent,
  [MessageKind.Video]: mediaContent,
  [MessageKind.Audio]: mediaContent,
  [MessageKind.Document]: mediaContent,
  [MessageKind.Sticker]: mediaContent,
  [MessageKind.Location]: (body) => ({
    kind: MessageKind.Location,
    latitude: body.latitude,
    longitude: body.longitude,
    name: body.name,
    address: body.address,
  }),
  [MessageKind.Contacts]: (body) => ({ kind: MessageKind.Contacts, contacts: body.contacts }),
  [MessageKind.Reaction]: (body) => ({ kind: MessageKind.Reaction, targetMessageId: body.target_message_id, emoji: body.emoji }),
  [MessageKind.Choice]: (body) => ({
    kind: MessageKind.Choice,
    optionId: body.option_id,
    optionTitle: body.title,
    optionDescription: body.description,
  }),
};

function decodeBytes(input: { base64: string }): Uint8Array {
  return Uint8Array.from(atob(input.base64), (character) => character.charCodeAt(0));
}

function mediaFitError(input: { body: MediaBody; sizeBytes: number }): InboxError | null {
  try {
    assertMediaFits({ kind: input.body.kind, mimeType: input.body.mime_type, sizeBytes: input.sizeBytes });
    return null;
  } catch (error) {
    if (error instanceof InboxError) return error;
    throw error;
  }
}

function errorBody(input: { error: InboxError }) {
  return { error: input.error.code, message: input.error.message };
}

const OWNER_NOT_FOUND_MESSAGE = 'owner: not found';
const OWNER_PHONE_MESSAGE = 'phone: expected 8 to 15 digits';

export const devOwnerRoutes = new Hono<{ Bindings: Bindings }>();

function findOwner(input: { bindings: Bindings; phone: string }): Promise<OwnerIdentity | null> {
  if (!OWNER_PHONE_PATTERN.test(input.phone)) return Promise.resolve(null);
  return findOwnerByPhone({ database: input.bindings.CONNECTIONS, phone: input.phone });
}

async function channelIdOrGiven(input: { inbox: DevAccountInboxRpc; messageId: string }): Promise<string> {
  const channelMessageId = await input.inbox.channelMessageIdOf({ messageId: input.messageId });
  if (channelMessageId === null) return input.messageId;
  return channelMessageId;
}

async function resolveChannelReferences(input: { inbox: DevAccountInboxRpc; body: OwnerMessageBody; content: OwnerInboundContent }) {
  const { inbox, body, content } = input;
  const replyToChannelMessageId = body.reply_to === null ? null : await channelIdOrGiven({ inbox, messageId: body.reply_to });
  if (content.kind !== MessageKind.Reaction || content.targetMessageId === null) return { replyToChannelMessageId, content };
  return {
    replyToChannelMessageId,
    content: { ...content, targetMessageId: await channelIdOrGiven({ inbox, messageId: content.targetMessageId }) },
  };
}

async function buildOwnerEntry(input: {
  bindings: Bindings;
  accountId: string;
  body: OwnerMessageBody;
  downloadsMedia: boolean;
}): Promise<ChannelInboundEntry> {
  const { bindings, accountId, body, downloadsMedia } = input;
  const clock = createPlatformClock();
  const inbox = accountInboxOf<DevAccountInboxRpc>({ bindings, accountId });
  await new D1MessageIndex({ database: bindings.CONNECTIONS }).record({ id: body.wamid, accountId, at: clock.now() });
  if ('data_base64' in body && downloadsMedia) {
    const bytes = decodeBytes({ base64: body.data_base64 });
    await mediaStoreOf({ bindings, clock }).put({
      accountId,
      mediaId: body.wamid,
      body: new Blob([bytes]).stream(),
      sizeBytes: bytes.byteLength,
      mimeType: body.mime_type,
    });
  }
  const buildContent = CONTENT_BUILDERS[body.kind] as (body: OwnerMessageBody) => OwnerInboundContent;
  const { replyToChannelMessageId, content } = await resolveChannelReferences({ inbox, body, content: buildContent(body) });
  const clockOffsetMs = await inbox.advanceClock({ advanceMs: 0 });
  return {
    kind: ChannelInboundKind.Owner,
    at: clock.now() + clockOffsetMs,
    content,
    replyToChannelMessageId,
    forwarded: ForwardedKind.None,
    noticeText: null,
  };
}

devOwnerRoutes.post(`${DEV_OWNER_PATH_PREFIX}/messages`, async (context) => {
  const phone = context.req.param('phone');
  if (!OWNER_PHONE_PATTERN.test(phone))
    return context.json(errorBody({ error: invalidInput({ message: OWNER_PHONE_MESSAGE }) }), HttpStatus.BadRequest);
  const parsed = ownerMessageSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return context.json(errorBody({ error: invalidInput({ message: z.prettifyError(parsed.error) }) }), HttpStatus.BadRequest);
  const body = parsed.data;
  if ('data_base64' in body) {
    const fitError = mediaFitError({ body, sizeBytes: decodeBytes({ base64: body.data_base64 }).byteLength });
    if (fitError) return context.json(errorBody({ error: fitError }), ERROR_STATUS[fitError.code]);
  }
  const { messageId, agent, duplicate } = await receiveOwnerInbound({
    bindings: context.env,
    waId: phone,
    channelMessageId: body.wamid,
    entryOf: ({ accountId, downloadsMedia }) => buildOwnerEntry({ bindings: context.env, accountId, body, downloadsMedia }),
  });
  return context.json({ message_id: messageId, agent, duplicate }, HttpStatus.Ok);
});

devOwnerRoutes.get(`${DEV_OWNER_PATH_PREFIX}/screen`, async (context) => {
  const owner = await findOwner({ bindings: context.env, phone: context.req.param('phone') });
  if (!owner) return context.json(errorBody({ error: notFound({ message: OWNER_NOT_FOUND_MESSAGE }) }), HttpStatus.NotFound);
  const { accountId } = owner;
  const entries = await accountInboxOf<DevAccountInboxRpc>({ bindings: context.env, accountId }).readScreen();
  return context.json({ entries }, HttpStatus.Ok);
});

devOwnerRoutes.post(`${DEV_OWNER_PATH_PREFIX}/clock`, async (context) => {
  const owner = await findOwner({ bindings: context.env, phone: context.req.param('phone') });
  if (!owner) return context.json(errorBody({ error: notFound({ message: OWNER_NOT_FOUND_MESSAGE }) }), HttpStatus.NotFound);
  const { accountId } = owner;
  const parsed = clockSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return context.json(errorBody({ error: invalidInput({ message: z.prettifyError(parsed.error) }) }), HttpStatus.BadRequest);
  const offsetMs = await accountInboxOf<DevAccountInboxRpc>({ bindings: context.env, accountId }).advanceClock({
    advanceMs: parsed.data.advance_ms,
  });
  logEvent({ event: LogEvent.ClockAdvanced, accountId });
  return context.json({ offset_ms: offsetMs }, HttpStatus.Ok);
});
