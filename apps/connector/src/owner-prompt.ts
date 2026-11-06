import type { Message } from '@zapbip/core';
import { MessageKind, WAKE_INSTRUCTION } from '@zapbip/types';

type MessageOfKind<Kind extends MessageKind> = Extract<Message, { kind: Kind }>;
type MediaKind = MessageKind.Image | MessageKind.Video | MessageKind.Audio | MessageKind.Document | MessageKind.Sticker;
type OwnerTextBuilders = { [Kind in MessageKind]: (input: { message: MessageOfKind<Kind> }) => string };

const CHANNEL_OPENING = '<channel source="zapbip" sender="owner" verified="true">';
const CHANNEL_CLOSING = '</channel>';

function kindLabel(input: { message: Message }): string {
  return input.message.kind;
}

function mediaText(input: { message: MessageOfKind<MediaKind> }): string {
  const { message } = input;
  if (message.caption === null) return kindLabel({ message });
  return `${kindLabel({ message })}\n${message.caption}`;
}

const OWNER_TEXT_BUILDERS: OwnerTextBuilders = {
  [MessageKind.Text]: ({ message }) => message.text,
  [MessageKind.Image]: mediaText,
  [MessageKind.Video]: mediaText,
  [MessageKind.Audio]: mediaText,
  [MessageKind.Document]: mediaText,
  [MessageKind.Sticker]: mediaText,
  [MessageKind.Location]: kindLabel,
  [MessageKind.Contacts]: kindLabel,
  [MessageKind.Reaction]: ({ message }) => {
    if (message.emoji === null) return kindLabel({ message });
    return message.emoji;
  },
  [MessageKind.Choice]: ({ message }) => {
    if (message.selected === null) return kindLabel({ message });
    return message.selected.title;
  },
};

export function escapeChannelText(input: { text: string }): string {
  return input.text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function ownerMessageText(input: { message: Message }): string {
  const buildText = OWNER_TEXT_BUILDERS[input.message.kind] as (input: { message: Message }) => string;
  return buildText(input);
}

export function buildOwnerPrompt(input: { message: Message }): string {
  const channelText = escapeChannelText({ text: ownerMessageText(input) });
  return `${CHANNEL_OPENING}${channelText}${CHANNEL_CLOSING}\n${WAKE_INSTRUCTION}`;
}
