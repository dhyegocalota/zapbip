import { ForwardedKind, MessageKind, type OwnerLocale } from '@zapbip/types';
import { assertMediaFits, InboxError, invalidInput, notFound, type OwnerInboundContent } from '@zapbip/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { D1MessageIndex } from '../adapters/d1/d1-message-index';
import { findOwnerByPhone } from '../adapters/d1/d1-owner-directory';
import { createPlatformClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
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
const wakeScriptSchema = z.object({
  responses: z.array(
    z.object({ statusCode: z.number().int().nullable(), errorName: z.string().nullable(), retryAfterMs: z.number().int().nullable() }),
  ),
});
const NO_CONTENT_STATUS = 204;
const FIND_AGENT_STATEMENT = 'SELECT 1 AS present FROM connections WHERE account_id = ? AND agent = ?';

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

export const devOwnerRoutes = new Hono<{ Bindings: Bindings }>();

function findOwner(input: { bindings: Bindings; phone: string }): Promise<OwnerIdentity | null> {
  if (!OWNER_PHONE_PATTERN.test(input.phone)) return Promise.resolve(null);
  return findOwnerByPhone({ database: input.bindings.CONNECTIONS, phone: input.phone });
}

async function findOwnerOfAgent(input: { bindings: Bindings; phone: string; agent: string }): Promise<OwnerIdentity | null> {
  const owner = await findOwner(input);
  if (!owner) return null;
  const connection = await input.bindings.CONNECTIONS.prepare(FIND_AGENT_STATEMENT).bind(owner.accountId, input.agent).first();
  if (!connection) return null;
  return owner;
}

devOwnerRoutes.post(`${DEV_OWNER_PATH_PREFIX}/messages`, async (context) => {
  const owner = await findOwner({ bindings: context.env, phone: context.req.param('phone') });
  if (!owner) return context.json(errorBody({ error: notFound({ message: OWNER_NOT_FOUND_MESSAGE }) }), HttpStatus.NotFound);
  const { accountId, ownerLocale } = owner;
  const parsed = ownerMessageSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return context.json(errorBody({ error: invalidInput({ message: z.prettifyError(parsed.error) }) }), HttpStatus.BadRequest);
  const body = parsed.data;
  const clock = createPlatformClock();
  const inbox = accountInboxOf<DevAccountInboxRpc>({ bindings: context.env, accountId });
  await new D1MessageIndex({ database: context.env.CONNECTIONS }).record({ id: body.wamid, accountId, at: clock.now() });
  if ('data_base64' in body) {
    const bytes = decodeBytes({ base64: body.data_base64 });
    const fitError = mediaFitError({ body, sizeBytes: bytes.byteLength });
    if (fitError) return context.json(errorBody({ error: fitError }), ERROR_STATUS[fitError.code]);
    await mediaStoreOf({ bindings: context.env, clock }).put({
      accountId,
      mediaId: body.wamid,
      body: new Blob([bytes]).stream(),
      sizeBytes: bytes.byteLength,
      mimeType: body.mime_type,
    });
  }
  const clockOffsetMs = await inbox.advanceClock({ advanceMs: 0 });
  const buildContent = CONTENT_BUILDERS[body.kind] as (body: OwnerMessageBody) => OwnerInboundContent;
  const outcome = await inbox.receiveOwnerMessage({
    ownerLocale,
    channelMessageId: body.wamid,
    ownerMessage: {
      at: clock.now() + clockOffsetMs,
      replyToMessageId: body.reply_to,
      forwarded: ForwardedKind.None,
      content: buildContent(body),
    },
  });
  if (!outcome.ok) return context.json({ error: outcome.errorCode, message: outcome.message }, ERROR_STATUS[outcome.errorCode]);
  const { messageId, agent, duplicate } = outcome.value;
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

devOwnerRoutes.post(`${DEV_OWNER_PATH_PREFIX}/agents/:agent/wake/script`, async (context) => {
  const agent = context.req.param('agent');
  const owner = await findOwnerOfAgent({ bindings: context.env, phone: context.req.param('phone'), agent });
  if (!owner) return context.json(errorBody({ error: notFound({ message: OWNER_NOT_FOUND_MESSAGE }) }), HttpStatus.NotFound);
  const parsed = wakeScriptSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return context.json(errorBody({ error: invalidInput({ message: z.prettifyError(parsed.error) }) }), HttpStatus.BadRequest);
  await accountInboxOf<DevAccountInboxRpc>({ bindings: context.env, accountId: owner.accountId }).devScriptWake({
    agent,
    responses: parsed.data.responses,
  });
  return context.body(null, NO_CONTENT_STATUS);
});

devOwnerRoutes.get(`${DEV_OWNER_PATH_PREFIX}/agents/:agent/wake/requests`, async (context) => {
  const agent = context.req.param('agent');
  const owner = await findOwnerOfAgent({ bindings: context.env, phone: context.req.param('phone'), agent });
  if (!owner) return context.json(errorBody({ error: notFound({ message: OWNER_NOT_FOUND_MESSAGE }) }), HttpStatus.NotFound);
  const requests = await accountInboxOf<DevAccountInboxRpc>({ bindings: context.env, accountId: owner.accountId }).devReadWakeRequests({
    agent,
  });
  return context.json(requests, HttpStatus.Ok);
});

devOwnerRoutes.post(`${DEV_OWNER_PATH_PREFIX}/wake/run`, async (context) => {
  const owner = await findOwner({ bindings: context.env, phone: context.req.param('phone') });
  if (!owner) return context.json(errorBody({ error: notFound({ message: OWNER_NOT_FOUND_MESSAGE }) }), HttpStatus.NotFound);
  await accountInboxOf<DevAccountInboxRpc>({ bindings: context.env, accountId: owner.accountId }).devRunDueWakes();
  return context.body(null, NO_CONTENT_STATUS);
});
