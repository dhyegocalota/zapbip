import { formatOptionId, type Message, type MediaFields, type MediaSource } from '@zapbip/core';
import { MediaSourceKind, MessageDirection, MessageKind, MessageSender } from '@zapbip/types';
import { buildMediaLink } from './links';
import type { MessageWire, ToolContext } from './types';

type ContentWire = Pick<
  MessageWire,
  | 'text'
  | 'media_id'
  | 'media_status'
  | 'url'
  | 'mime_type'
  | 'size_bytes'
  | 'filename'
  | 'caption'
  | 'voice'
  | 'latitude'
  | 'longitude'
  | 'name'
  | 'address'
  | 'contacts'
  | 'emoji'
  | 'target_message_id'
  | 'choice'
>;

type ContentWireBuilders = {
  [Kind in MessageKind]: (input: { message: Extract<Message, { kind: Kind }>; link: string | null }) => ContentWire;
};

const NO_CONTENT: ContentWire = {
  text: null,
  media_id: null,
  media_status: null,
  url: null,
  mime_type: null,
  size_bytes: null,
  filename: null,
  caption: null,
  voice: null,
  latitude: null,
  longitude: null,
  name: null,
  address: null,
  contacts: null,
  emoji: null,
  target_message_id: null,
  choice: null,
};

function storedMediaId(source: MediaSource): string | null {
  if (source.kind === MediaSourceKind.Stored) return source.mediaId;
  return null;
}

function unavailableStatus(source: MediaSource): MediaSourceKind.Unavailable | null {
  if (source.kind === MediaSourceKind.Unavailable) return MediaSourceKind.Unavailable;
  return null;
}

function mediaContent(input: { fields: MediaFields; link: string | null; voice: boolean | null }): ContentWire {
  const { fields } = input;
  return {
    ...NO_CONTENT,
    media_id: storedMediaId(fields.source),
    media_status: unavailableStatus(fields.source),
    url: input.link,
    mime_type: fields.mimeType,
    size_bytes: fields.sizeBytes,
    filename: fields.filename,
    caption: fields.caption,
    voice: input.voice,
  };
}

const CONTENT_WIRE_BUILDERS: ContentWireBuilders = {
  [MessageKind.Text]: ({ message }) => ({ ...NO_CONTENT, text: message.text }),
  [MessageKind.Image]: ({ message, link }) => mediaContent({ fields: message, link, voice: null }),
  [MessageKind.Video]: ({ message, link }) => mediaContent({ fields: message, link, voice: null }),
  [MessageKind.Audio]: ({ message, link }) => mediaContent({ fields: message, link, voice: message.voice }),
  [MessageKind.Document]: ({ message, link }) => mediaContent({ fields: message, link, voice: null }),
  [MessageKind.Sticker]: ({ message, link }) => mediaContent({ fields: message, link, voice: null }),
  [MessageKind.Location]: ({ message }) => ({
    ...NO_CONTENT,
    latitude: message.latitude,
    longitude: message.longitude,
    name: message.name,
    address: message.address,
  }),
  [MessageKind.Contacts]: ({ message }) => ({ ...NO_CONTENT, contacts: message.contacts }),
  [MessageKind.Reaction]: ({ message }) => ({ ...NO_CONTENT, emoji: message.emoji, target_message_id: message.targetMessageId }),
  [MessageKind.Choice]: ({ message }) => {
    const toWireOption = (option: { optionIndex: number; title: string; description: string | null }) => ({
      option_id: formatOptionId({ questionId: message.questionId, optionIndex: option.optionIndex }),
      title: option.title,
      description: option.description,
    });
    return {
      ...NO_CONTENT,
      choice: {
        question_id: message.questionId,
        options: message.options.map(toWireOption),
        selected: message.selected ? toWireOption(message.selected) : null,
      },
    };
  },
};

export function toIsoTimestamp(input: { epochMs: number }): string {
  return new Date(input.epochMs).toISOString();
}

export function toWireMessage(input: { message: Message; link: string | null }): MessageWire {
  const { message } = input;
  const isFromOwner = message.direction === MessageDirection.FromOwner;
  const buildContent = CONTENT_WIRE_BUILDERS[message.kind] as (input: { message: Message; link: string | null }) => ContentWire;
  return {
    message_id: message.messageId,
    direction: message.direction,
    sender: isFromOwner ? MessageSender.Owner : MessageSender.Agent,
    verified: isFromOwner,
    agent: message.agent,
    at: toIsoTimestamp({ epochMs: message.at }),
    reply_to: message.replyToMessageId,
    delivery: message.delivery,
    read: message.readByAgent,
    kind: message.kind,
    ...buildContent({ message, link: input.link }),
  };
}

async function resolveMediaLink(input: { context: ToolContext; message: Message }): Promise<string | null> {
  const { message } = input;
  if (!('source' in message)) return null;
  if (message.source.kind === MediaSourceKind.Link) return message.source.link;
  if (message.source.kind === MediaSourceKind.Unavailable) return null;
  return buildMediaLink({ context: input.context, mediaId: message.source.mediaId });
}

export function toWireMessages(input: { context: ToolContext; messages: Message[] }): Promise<MessageWire[]> {
  return Promise.all(
    input.messages.map(async (message) => toWireMessage({ message, link: await resolveMediaLink({ context: input.context, message }) })),
  );
}
