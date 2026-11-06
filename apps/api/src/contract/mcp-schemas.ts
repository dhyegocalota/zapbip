import { z } from 'zod';
import { ASK_MAX_WAIT_SECONDS, HISTORY_LIMIT } from '@zapbip/core';
import {
  DeliveryState,
  ForwardedKind,
  InboxStatus,
  MediaSourceKind,
  MessageDirection,
  MessageKind,
  MessageSender,
  OwnerLocale,
  ReplyStatus,
  SetWakeStatus,
  WakeMode,
  WakeProvider,
  WakeRung,
} from '@zapbip/types';

const nullableString = z.string().nullable().default(null);
const nullableNumber = z.number().nullable().default(null);

export const sendableMediaKind = z.enum([
  MessageKind.Image,
  MessageKind.Video,
  MessageKind.Audio,
  MessageKind.Document,
  MessageKind.Sticker,
]);

export const contactInputSchema = z.object({
  name: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()).default([]),
  organization: nullableString,
});

export const sendMessageInputShape = { text: z.string(), reply_to: nullableString };
export const sendMediaInputShape = {
  kind: sendableMediaKind,
  voice: z.boolean().default(false),
  url: nullableString,
  upload_id: nullableString,
  caption: nullableString,
  filename: nullableString,
  reply_to: nullableString,
};
export const sendLocationInputShape = {
  latitude: z.number(),
  longitude: z.number(),
  name: nullableString,
  address: nullableString,
  reply_to: nullableString,
};
export const sendContactInputShape = { contacts: z.array(contactInputSchema), reply_to: nullableString };
export const reactInputShape = { message_id: z.string(), emoji: z.string() };
export const askInputShape = {
  question: z.string(),
  options: z.array(z.object({ title: z.string(), description: nullableString })),
  timeout_seconds: z.number().int().default(ASK_MAX_WAIT_SECONDS),
};
export const waitForReplyInputShape = {
  question_id: nullableString,
  timeout_seconds: z.number().int().default(ASK_MAX_WAIT_SECONDS),
};
export const getMessagesInputShape = { limit: z.number().int().default(HISTORY_LIMIT) };
export const checkInboxInputShape = {};
export const createUploadInputShape = {
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int(),
};

export const wireOptionSchema = z.object({
  option_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
});

export const wireContactSchema = z.object({
  name: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  organization: z.string().nullable(),
});

export const messageWireSchema = z.object({
  message_id: z.string(),
  direction: z.enum(MessageDirection),
  sender: z.enum(MessageSender),
  verified: z.boolean(),
  forwarded: z.enum(ForwardedKind),
  agent: z.string().nullable(),
  at: z.iso.datetime(),
  reply_to: z.string().nullable(),
  delivery: z.enum(DeliveryState).nullable(),
  read: z.boolean(),
  kind: z.enum(MessageKind),
  text: z.string().nullable(),
  media_id: z.string().nullable(),
  media_status: z.literal(MediaSourceKind.Unavailable).nullable(),
  url: z.string().nullable(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().nullable(),
  filename: z.string().nullable(),
  caption: z.string().nullable(),
  voice: z.boolean().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  contacts: z.array(wireContactSchema).nullable(),
  emoji: z.string().nullable(),
  target_message_id: z.string().nullable(),
  choice: z
    .object({
      question_id: z.string(),
      options: z.array(wireOptionSchema),
      selected: wireOptionSchema.nullable(),
    })
    .nullable(),
});

export const deliveryResultOutputShape = {
  message_id: z.string(),
  delivery: z.enum([DeliveryState.Sent, DeliveryState.Queued]),
};

export const replyResultOutputShape = {
  status: z.enum(ReplyStatus),
  answer: z.string().nullable(),
  message_id: z.string().nullable(),
  question_id: z.string().nullable(),
  messages: z.array(messageWireSchema).nullable(),
};

export const getMessagesOutputShape = {
  unread: z.array(messageWireSchema),
  history: z.array(messageWireSchema),
};

export const checkInboxOutputShape = {
  status: z.enum(InboxStatus),
  messages: z.array(messageWireSchema),
};

export const createUploadOutputShape = {
  upload_id: z.string(),
  upload_url: z.string(),
  expires_at: z.iso.datetime(),
};

export const setWakeInputShape = {
  mode: z.enum(WakeMode),
  url: nullableString,
  token: nullableString,
  interval_minutes: nullableNumber,
  standby_agent: nullableString,
};

export const setWakeInputSchema = z.strictObject(setWakeInputShape);

export const setWakeOutputShape = {
  status: z.enum(SetWakeStatus),
  wake_mode: z.enum(WakeMode),
  effective_rung: z.enum(WakeRung),
  provider: z.enum(WakeProvider).nullable(),
};
