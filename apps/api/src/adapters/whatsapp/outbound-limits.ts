import {
  BUTTON_TITLE_MAX_CHARS,
  ChannelError,
  InboxError,
  LIST_ROW_TITLE_MAX_CHARS,
  MEDIA_MAX_BYTES,
  QUESTION_MAX_CHARS,
  WHATSAPP_TEXT_MAX_CHARS,
  type MediaMessageKind,
} from '@zapbip/core';
import { ChannelErrorKind, InboxErrorCode, MessageKind } from '@zapbip/types';
import {
  OUTBOUND_BUTTON_BODY_MAX_CHARS,
  OUTBOUND_BUTTON_ID_MAX_CHARS,
  OUTBOUND_BUTTON_MAX_REPLIES,
  OUTBOUND_LIST_BUTTON_LABEL_MAX_CHARS,
  OUTBOUND_LIST_MAX_ROWS,
  OUTBOUND_LIST_ROW_DESCRIPTION_MAX_CHARS,
  OUTBOUND_LIST_ROW_ID_MAX_CHARS,
  OUTBOUND_LIST_SECTION_TITLE_MAX_CHARS,
  OUTBOUND_STICKER_MAX_BYTES,
} from './whatsapp-constants';

const OUTBOUND_MEDIA_MAX_BYTES: Record<MediaMessageKind, number> = {
  ...MEDIA_MAX_BYTES,
  [MessageKind.Sticker]: OUTBOUND_STICKER_MAX_BYTES,
};

const WORD_PROCESSING_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const OUTBOUND_MEDIA_MIME_TYPES: Record<MediaMessageKind, readonly string[]> = {
  [MessageKind.Image]: ['image/jpeg', 'image/png', 'image/webp'],
  [MessageKind.Video]: ['video/3gpp', 'video/mp4'],
  [MessageKind.Audio]: ['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'],
  [MessageKind.Document]: ['application/pdf', 'text/plain', ...WORD_PROCESSING_MIME_TYPES],
  [MessageKind.Sticker]: ['image/webp'],
};

function invalidField(input: { field: string; rule: string }): InboxError {
  return new InboxError({ code: InboxErrorCode.InvalidInput, message: `${input.field}: ${input.rule}` });
}

function assertMaxCharacters(input: { field: string; value: string; maxChars: number }): void {
  if ([...input.value].length <= input.maxChars) return;
  throw invalidField({ field: input.field, rule: `must be at most ${input.maxChars} characters` });
}

function mediaRejected(input: { message: string }): ChannelError {
  return new ChannelError({ kind: ChannelErrorKind.MediaRejected, message: input.message, errorCode: null });
}

export function assertOutboundMedia(input: { mediaKind: MediaMessageKind; mimeType: string | null; sizeBytes: number | null }): void {
  const { mediaKind, mimeType, sizeBytes } = input;
  const subject = mimeType === null ? mediaKind : `${mediaKind} ${mimeType}`;
  const isMimeTypeRefused = mimeType !== null && !OUTBOUND_MEDIA_MIME_TYPES[mediaKind].includes(mimeType);
  if (isMimeTypeRefused) throw mediaRejected({ message: `${subject}: type is not allowed` });
  const isTooLarge = sizeBytes !== null && sizeBytes > OUTBOUND_MEDIA_MAX_BYTES[mediaKind];
  if (isTooLarge) throw mediaRejected({ message: `${subject}: size exceeds ${OUTBOUND_MEDIA_MAX_BYTES[mediaKind]} bytes` });
}

export function assertButtonLimits(input: { bodyText: string; replies: { id: string; title: string }[] }): void {
  assertMaxCharacters({ field: 'interactive.body.text', value: input.bodyText, maxChars: OUTBOUND_BUTTON_BODY_MAX_CHARS });
  if (input.replies.length > OUTBOUND_BUTTON_MAX_REPLIES)
    throw invalidField({ field: 'interactive.action.buttons', rule: `must have at most ${OUTBOUND_BUTTON_MAX_REPLIES} entries` });
  input.replies.forEach((reply, index) => {
    const field = `interactive.action.buttons[${index}].reply`;
    assertMaxCharacters({ field: `${field}.title`, value: reply.title, maxChars: BUTTON_TITLE_MAX_CHARS });
    assertMaxCharacters({ field: `${field}.id`, value: reply.id, maxChars: OUTBOUND_BUTTON_ID_MAX_CHARS });
  });
}

export function assertListLimits(input: {
  bodyText: string;
  buttonLabel: string;
  sectionTitle: string;
  rows: { id: string; title: string; description: string | null }[];
}): void {
  assertMaxCharacters({ field: 'interactive.body.text', value: input.bodyText, maxChars: QUESTION_MAX_CHARS });
  assertMaxCharacters({ field: 'interactive.action.button', value: input.buttonLabel, maxChars: OUTBOUND_LIST_BUTTON_LABEL_MAX_CHARS });
  assertMaxCharacters({
    field: 'interactive.action.sections[0].title',
    value: input.sectionTitle,
    maxChars: OUTBOUND_LIST_SECTION_TITLE_MAX_CHARS,
  });
  if (input.rows.length > OUTBOUND_LIST_MAX_ROWS)
    throw invalidField({ field: 'interactive.action.sections', rule: `must have at most ${OUTBOUND_LIST_MAX_ROWS} rows` });
  input.rows.forEach((row, index) => {
    const field = `interactive.action.sections[0].rows[${index}]`;
    assertMaxCharacters({ field: `${field}.id`, value: row.id, maxChars: OUTBOUND_LIST_ROW_ID_MAX_CHARS });
    assertMaxCharacters({ field: `${field}.title`, value: row.title, maxChars: LIST_ROW_TITLE_MAX_CHARS });
    if (row.description === null) return;
    assertMaxCharacters({ field: `${field}.description`, value: row.description, maxChars: OUTBOUND_LIST_ROW_DESCRIPTION_MAX_CHARS });
  });
}

export function assertTextBody(input: { body: string }): void {
  assertMaxCharacters({ field: 'text.body', value: input.body, maxChars: WHATSAPP_TEXT_MAX_CHARS });
}

export function assertReactionTarget(input: { messageId: string | null }): void {
  const isMissing = input.messageId === null || input.messageId.length === 0;
  if (!isMissing) return;
  throw new ChannelError({
    kind: ChannelErrorKind.ReactionRejected,
    message: 'reaction.message_id: must not be empty',
    errorCode: null,
  });
}
