import type { ContactCard, MediaMessageKind, OwnerInboundContent, UnavailableOwnerMedia } from '@zapbip/core';
import { ChannelInboundKind, IdPrefix, MessageKind } from '@zapbip/types';
import { z } from 'zod';
import { OWNER_PHONE_PATTERN } from '../../contract/constants';
import { sha256Hex } from '../platform/hash';
import { unixSecondsSchema, type ParsedStatus, parseStatusItems } from './status-parser';
import { OperatorLogReason, ParsedEntryKind, WhatsAppInteractiveType, WhatsAppMessageType } from './whatsapp-enums';

export enum WebhookField {
  Messages = 'messages',
  Statuses = 'statuses',
}

export type MediaDownloadRequest = {
  mediaId: string;
  channelMediaId: string;
  mimeType: string;
  sha256Base64: string;
  filename: string | null;
  caption: string | null;
  mediaKind: MediaMessageKind;
};

export type ParsedInboundEntry =
  | {
      kind: ChannelInboundKind.Owner;
      at: number;
      content: OwnerInboundContent | UnavailableOwnerMedia;
      replyToChannelMessageId: string | null;
      forwarded: boolean;
    }
  | { kind: ChannelInboundKind.WindowOnly; at: number }
  | { kind: ChannelInboundKind.Unsupported; at: number; unsupportedType: string | null };

export type ParsedEntry =
  | {
      kind: ParsedEntryKind.Inbound;
      channelMessageId: string;
      fromWaId: string;
      at: number;
      entry: ParsedInboundEntry;
      media: MediaDownloadRequest | null;
    }
  | { kind: ParsedEntryKind.Rejected; reason: OperatorLogReason };

export type ParsedChange = {
  phoneNumberId: string | null;
  field: string;
  entries: ParsedEntry[];
  statuses: ParsedStatus[];
};

type MessageParts = {
  channelMessageId: string;
  at: number;
  replyToChannelMessageId: string | null;
  forwarded: boolean;
  payload: unknown;
};
type ParsedContent = { entry: ParsedInboundEntry; media: MediaDownloadRequest | null };
type MessageHandler = (input: { parts: MessageParts }) => Promise<ParsedContent>;

const HANDLED_FIELDS: string[] = Object.values(WebhookField);
const KNOWN_TYPES: string[] = Object.values(WhatsAppMessageType);

const optionalText = z.string().nullable().default(null);

const envelopeSchema = z.object({ entry: z.array(z.object({ changes: z.array(z.unknown()).default([]) })) });
const changeHeadSchema = z.object({ field: z.string(), value: z.unknown() });
const changeValueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string() }).optional(),
  messages: z.array(z.unknown()).default([]),
  statuses: z.array(z.unknown()).default([]),
});
const messageHeadSchema = z.object({
  id: z.string(),
  timestamp: unixSecondsSchema,
  type: z.string(),
  context: z
    .object({
      id: z.string().optional(),
      forwarded: z.boolean().default(false),
      frequently_forwarded: z.boolean().default(false),
    })
    .optional(),
});

const textSchema = z.object({ body: z.string() });
const mediaSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  caption: optionalText,
  filename: optionalText,
  voice: z.boolean().default(false),
});
const locationSchema = z.object({ latitude: z.number(), longitude: z.number(), name: optionalText, address: optionalText });
const contactSchema = z.object({
  name: z.object({ formatted_name: z.string() }),
  phones: z.array(z.object({ phone: z.string() })).default([]),
  emails: z.array(z.object({ email: z.string() })).default([]),
  org: z.object({ company: optionalText }).default({ company: null }),
});
const reactionSchema = z.object({
  message_id: z.string(),
  emoji: optionalText.transform((emoji) => (emoji === '' ? null : emoji)),
});
const interactiveHeadSchema = z.object({ type: z.string() });
const choiceSchema = z.object({ id: z.string(), title: z.string(), description: optionalText });
const unsupportedSchema = z.object({ type: z.string() }).optional();

async function mediaIdOf(input: { channelMessageId: string }): Promise<string> {
  return `${IdPrefix.Media}_${await sha256Hex({ value: input.channelMessageId })}`;
}

function ownerContent(input: { parts: MessageParts; content: OwnerInboundContent | UnavailableOwnerMedia }): ParsedContent {
  const { parts, content } = input;
  const entry = {
    kind: ChannelInboundKind.Owner as const,
    at: parts.at,
    content,
    replyToChannelMessageId: parts.replyToChannelMessageId,
    forwarded: parts.forwarded,
  };
  return { entry, media: null };
}

function unsupportedContent(input: { parts: MessageParts; unsupportedType: string | null }): ParsedContent {
  return { entry: { kind: ChannelInboundKind.Unsupported, at: input.parts.at, unsupportedType: input.unsupportedType }, media: null };
}

function mediaHandler(input: { mediaKind: MediaMessageKind }): MessageHandler {
  return async ({ parts }) => {
    const media = mediaSchema.parse(parts.payload);
    const content = { kind: input.mediaKind, voice: media.voice, filename: media.filename, caption: media.caption };
    const request = {
      mediaId: await mediaIdOf({ channelMessageId: parts.channelMessageId }),
      channelMediaId: media.id,
      mimeType: media.mime_type,
      sha256Base64: media.sha256,
      filename: media.filename,
      caption: media.caption,
      mediaKind: input.mediaKind,
    };
    return { ...ownerContent({ parts, content }), media: request };
  };
}

function contactCardOf(input: { contact: z.infer<typeof contactSchema> }): ContactCard {
  const { contact } = input;
  return {
    name: contact.name.formatted_name,
    phones: contact.phones.map((phone) => phone.phone),
    emails: contact.emails.map((email) => email.email),
    organization: contact.org.company,
  };
}

const INTERACTIVE_HANDLERS: Record<WhatsAppInteractiveType, (input: { interactive: Record<string, unknown> }) => OwnerInboundContent> = {
  [WhatsAppInteractiveType.ButtonReply]: ({ interactive }) => choiceOf({ reply: interactive[WhatsAppInteractiveType.ButtonReply] }),
  [WhatsAppInteractiveType.ListReply]: ({ interactive }) => choiceOf({ reply: interactive[WhatsAppInteractiveType.ListReply] }),
};

function choiceOf(input: { reply: unknown }): OwnerInboundContent {
  const choice = choiceSchema.parse(input.reply);
  return { kind: MessageKind.Choice, optionId: choice.id, optionTitle: choice.title, optionDescription: choice.description };
}

function isInteractiveType(input: { type: string }): input is { type: WhatsAppInteractiveType } {
  return Object.values<string>(WhatsAppInteractiveType).includes(input.type);
}

const MESSAGE_HANDLERS: Record<WhatsAppMessageType, MessageHandler> = {
  [WhatsAppMessageType.Text]: async ({ parts }) =>
    ownerContent({ parts, content: { kind: MessageKind.Text, text: textSchema.parse(parts.payload).body } }),
  [WhatsAppMessageType.Image]: mediaHandler({ mediaKind: MessageKind.Image }),
  [WhatsAppMessageType.Video]: mediaHandler({ mediaKind: MessageKind.Video }),
  [WhatsAppMessageType.Audio]: mediaHandler({ mediaKind: MessageKind.Audio }),
  [WhatsAppMessageType.Document]: mediaHandler({ mediaKind: MessageKind.Document }),
  [WhatsAppMessageType.Sticker]: mediaHandler({ mediaKind: MessageKind.Sticker }),
  [WhatsAppMessageType.Location]: async ({ parts }) =>
    ownerContent({ parts, content: { kind: MessageKind.Location, ...locationSchema.parse(parts.payload) } }),
  [WhatsAppMessageType.Contacts]: async ({ parts }) => {
    const contacts = z.array(contactSchema).min(1).parse(parts.payload);
    return ownerContent({
      parts,
      content: { kind: MessageKind.Contacts, contacts: contacts.map((contact) => contactCardOf({ contact })) },
    });
  },
  [WhatsAppMessageType.Reaction]: async ({ parts }) => {
    const reaction = reactionSchema.parse(parts.payload);
    return ownerContent({ parts, content: { kind: MessageKind.Reaction, targetMessageId: reaction.message_id, emoji: reaction.emoji } });
  },
  [WhatsAppMessageType.Interactive]: async ({ parts }) => {
    const interactive = z.record(z.string(), z.unknown()).parse(parts.payload);
    const head = interactiveHeadSchema.parse(interactive);
    if (!isInteractiveType(head)) return unsupportedContent({ parts, unsupportedType: head.type });
    return ownerContent({ parts, content: INTERACTIVE_HANDLERS[head.type]({ interactive }) });
  },
  [WhatsAppMessageType.Button]: async ({ parts }) => ({ entry: { kind: ChannelInboundKind.WindowOnly, at: parts.at }, media: null }),
  [WhatsAppMessageType.Unsupported]: async ({ parts }) => {
    const detail = unsupportedSchema.parse(parts.payload);
    return unsupportedContent({ parts, unsupportedType: detail === undefined ? null : detail.type });
  },
};

type MessageContext = z.infer<typeof messageHeadSchema>['context'];

function isForwarded(input: { context: MessageContext }): boolean {
  const { context } = input;
  if (context === undefined) return false;
  return context.forwarded || context.frequently_forwarded;
}

function replyTargetOf(input: { context: MessageContext }): string | null {
  const { context } = input;
  if (context === undefined || context.id === undefined) return null;
  return context.id;
}

function rejected(input: { reason: OperatorLogReason }): ParsedEntry {
  return { kind: ParsedEntryKind.Rejected, reason: input.reason };
}

async function parseEntry(input: { rawMessage: unknown }): Promise<ParsedEntry> {
  const record = z.record(z.string(), z.unknown()).safeParse(input.rawMessage);
  if (!record.success) return rejected({ reason: OperatorLogReason.MalformedEntry });
  const { from } = record.data;
  if (from === undefined) return rejected({ reason: OperatorLogReason.MissingSender });
  const isPhoneNumber = typeof from === 'string' && OWNER_PHONE_PATTERN.test(from);
  if (!isPhoneNumber) return rejected({ reason: OperatorLogReason.InvalidSender });
  const head = messageHeadSchema.safeParse(record.data);
  if (!head.success) return rejected({ reason: OperatorLogReason.MalformedEntry });
  const { id, timestamp, type, context } = head.data;
  const parts = {
    channelMessageId: id,
    at: timestamp,
    replyToChannelMessageId: replyTargetOf({ context }),
    forwarded: isForwarded({ context }),
    payload: record.data[type],
  };
  const isKnownType = KNOWN_TYPES.includes(type);
  try {
    const parsed = isKnownType
      ? await MESSAGE_HANDLERS[type as WhatsAppMessageType]({ parts })
      : unsupportedContent({ parts, unsupportedType: type });
    return { kind: ParsedEntryKind.Inbound, channelMessageId: id, fromWaId: from, at: timestamp, ...parsed };
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    return rejected({ reason: OperatorLogReason.MalformedEntry });
  }
}

async function parseChange(input: { rawChange: unknown }): Promise<ParsedChange[]> {
  const head = changeHeadSchema.safeParse(input.rawChange);
  if (!head.success) return [];
  const { field, value } = head.data;
  const isHandled = HANDLED_FIELDS.includes(field);
  if (!isHandled) return [{ phoneNumberId: null, field, entries: [], statuses: [] }];
  const parsedValue = changeValueSchema.safeParse(value);
  if (!parsedValue.success) return [];
  const { metadata, messages, statuses } = parsedValue.data;
  const entries = await Promise.all(messages.map((rawMessage) => parseEntry({ rawMessage })));
  return [
    {
      phoneNumberId: metadata === undefined ? null : metadata.phone_number_id,
      field,
      entries,
      statuses: parseStatusItems({ rawStatuses: statuses }),
    },
  ];
}

export async function parseWebhookNotification(input: { rawJson: unknown }): Promise<ParsedChange[]> {
  const notification = envelopeSchema.parse(input.rawJson);
  const rawChanges = notification.entry.flatMap((entry) => entry.changes);
  const changes = await Promise.all(rawChanges.map((rawChange) => parseChange({ rawChange })));
  return changes.flat();
}
